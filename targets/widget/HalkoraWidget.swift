import AppIntents
import SwiftUI
import WidgetKit

// Same App Group id as app.json's ios.entitlements + this target's
// expo-target.config.js (auto-synced from the main app) — must match
// EXACTLY (case-sensitive) or this reads an empty, unrelated container.
private let appGroup = "group.com.halkora.app.widget"
private let activeChallengesKey = "activeChallenges"

// Hand-maintained TR/EN copy, same pattern as supabase/functions/notify's
// COPY dict (docs/AGENTS.md) — this Swift target can't import src/i18n/*.
private struct WidgetCopy {
  let dayLabel: (Int, Int) -> String
  let checkInCta: String
  let doneLabel: String
  let emptyTitle: String
}

private let copyTr = WidgetCopy(
  dayLabel: { current, total in "Gün \(current)/\(total)" },
  checkInCta: "Check-in yap",
  doneLabel: "Yapıldı ✓",
  emptyTitle: "Bir halka oluştur"
)

private let copyEn = WidgetCopy(
  dayLabel: { current, total in "Day \(current)/\(total)" },
  checkInCta: "Check in",
  doneLabel: "Done ✓",
  emptyTitle: "Create a ring"
)

private func copyFor(_ locale: String?) -> WidgetCopy {
  locale == "en" ? copyEn : copyTr
}

// Mirrors one element of the array src/lib/widget.ts writes via
// ExtensionStorage.set — keep field names/types in sync with that file.
private struct HalkoraSnapshot: Codable {
  var challengeId: String
  var title: String
  var currentDay: Int
  var totalDays: Int
  // ExtensionStorage.set only allows string/number values inside an
  // object (no booleans) — 0/1 on the JS side.
  var checkedInToday: Int
  var locale: String?
}

private func loadActiveChallenges() -> [HalkoraSnapshot] {
  guard let defaults = UserDefaults(suiteName: appGroup),
    let data = defaults.data(forKey: activeChallengesKey),
    let list = try? JSONDecoder().decode([HalkoraSnapshot].self, from: data)
  else { return [] }
  return list
}

// MARK: - Per-instance widget configuration (App Intents)
//
// A WidgetKit view can't itself respond to a swipe gesture — Apple only
// allows Button/Toggle taps (iOS 17+). The system-native way to "swipe
// between halkalar" (saha testi bulgusu) is adding several copies of this
// SAME widget to the Home Screen and letting iOS stack them (or dragging
// one on top of another) — each copy independently configured to a
// specific challenge via long-press -> Edit Widget, exactly like a weather
// widget lets you pick which city each copy shows. ChallengeEntity +
// ChallengeQuery below is what powers that picker.

struct ChallengeEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Halka"
  static var defaultQuery = ChallengeQuery()

  var id: String
  var title: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(title)")
  }
}

struct ChallengeQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [ChallengeEntity] {
    loadActiveChallenges()
      .filter { identifiers.contains($0.challengeId) }
      .map { ChallengeEntity(id: $0.challengeId, title: $0.title) }
  }

  func suggestedEntities() async throws -> [ChallengeEntity] {
    loadActiveChallenges().map { ChallengeEntity(id: $0.challengeId, title: $0.title) }
  }

  func defaultResult() async -> ChallengeEntity? {
    try? await suggestedEntities().first
  }
}

struct SelectChallengeIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Halka Seç"
  static var description = IntentDescription("Bu widget'ın hangi halkayı göstereceğini seç.")

  @Parameter(title: "Halka")
  var challenge: ChallengeEntity?
}

// MARK: - Timeline

struct HalkoraEntry: TimelineEntry {
  let date: Date
  // fileprivate, not the struct's default internal — it exposes the
  // `private` HalkoraSnapshot type, and Swift requires a member's access
  // level to be no wider than the types it exposes.
  fileprivate let snapshot: HalkoraSnapshot?
}

struct HalkoraProvider: AppIntentTimelineProvider {
  typealias Intent = SelectChallengeIntent
  typealias Entry = HalkoraEntry

  func placeholder(in context: Context) -> HalkoraEntry {
    HalkoraEntry(
      date: .now,
      snapshot: HalkoraSnapshot(
        challengeId: "", title: "Halkora", currentDay: 4, totalDays: 30,
        checkedInToday: 0, locale: "tr"))
  }

  func snapshot(for configuration: SelectChallengeIntent, in context: Context) async -> HalkoraEntry {
    HalkoraEntry(date: .now, snapshot: resolve(configuration))
  }

  func timeline(for configuration: SelectChallengeIntent, in context: Context) async -> Timeline<HalkoraEntry> {
    let all = loadActiveChallenges()

    // Explicitly configured (Edit Widget -> picked one specific halka,
    // meant for stacking several copies) -> pin to just that one, no
    // auto-rotation.
    if let pickedId = configuration.challenge?.id,
      let picked = all.first(where: { $0.challengeId == pickedId })
    {
      return Timeline(entries: [HalkoraEntry(date: .now, snapshot: picked)], policy: .never)
    }

    // Unconfigured (the common case: just dragged onto the Home Screen) and
    // more than one active challenge -> auto-rotate through ALL of them
    // over time instead of always showing the same one forever (saha testi
    // bulgusu: "swipe desteklemiyorsa otomatik dönsün kendi içinde"). A
    // Timeline can carry several future-dated entries in one go — WidgetKit
    // switches between them locally as each date arrives, no extra reload
    // or network call spent per switch, only the one `timeline(for:)` call
    // that generated all of them counts against the daily refresh budget.
    if all.count > 1 {
      let rotationInterval: TimeInterval = 15 * 60  // 15 dk / halka
      let entries = all.enumerated().map { index, snapshot in
        HalkoraEntry(
          date: Date().addingTimeInterval(Double(index) * rotationInterval),
          snapshot: snapshot)
      }
      // Ask for a fresh timeline once the loop finishes a full pass — picks
      // up any challenge added/removed/checked-in since this was generated.
      let nextFullReload = Date().addingTimeInterval(Double(all.count) * rotationInterval)
      return Timeline(entries: entries, policy: .after(nextFullReload))
    }

    // Zero or exactly one active challenge -> nothing to rotate through.
    let single = all.first(where: { $0.checkedInToday == 0 }) ?? all.first
    return Timeline(entries: [HalkoraEntry(date: .now, snapshot: single)], policy: .never)
  }

  /// Used only for the instantaneous "Add Widget" gallery preview — not the
  /// real rotating timeline above, so a single best-guess pick is enough.
  private func resolve(_ configuration: SelectChallengeIntent) -> HalkoraSnapshot? {
    let all = loadActiveChallenges()
    if let pickedId = configuration.challenge?.id,
      let picked = all.first(where: { $0.challengeId == pickedId })
    {
      return picked
    }
    return all.first(where: { $0.checkedInToday == 0 }) ?? all.first
  }
}

// MARK: - View

// Named to avoid colliding with SwiftUI's own `View.accentColor(_:)`
// modifier — a top-level constant with that exact name gets shadowed by
// the method inside a View's body, silently resolving to the wrong thing.
private let halkoraEmber = Color(red: 1.0, green: 0.42, blue: 0.28)
private let halkoraBg = Color(red: 0.051, green: 0.055, blue: 0.067)

struct HalkoraWidgetView: View {
  var entry: HalkoraProvider.Entry

  var body: some View {
    Group {
      if let snapshot = entry.snapshot {
        let c = copyFor(snapshot.locale)
        let checkedIn = snapshot.checkedInToday != 0
        VStack(alignment: .leading, spacing: 6) {
          Text(snapshot.title)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.white)
            .lineLimit(2)
          Spacer(minLength: 4)
          Text(c.dayLabel(snapshot.currentDay, snapshot.totalDays))
            .font(.system(size: 11))
            .foregroundStyle(.white.opacity(0.55))
          HStack(spacing: 4) {
            Image(systemName: checkedIn ? "checkmark.circle.fill" : "circle")
              .font(.system(size: 12))
            Text(checkedIn ? c.doneLabel : c.checkInCta)
              .font(.system(size: 12, weight: .medium))
          }
          .foregroundStyle(checkedIn ? halkoraEmber : .white)
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        // A single tap target for the whole widget: if today's already
        // done, just open the ring; otherwise route through the
        // auto-check-in screen (app/widget-checkin/[id].tsx) — true
        // no-app-open check-in needs a separate AppIntent making its own
        // authenticated Supabase call from the widget process, saved for a
        // later round (docs/ROADMAP.md).
        .widgetURL(
          checkedIn
            ? URL(string: "halkora://challenge/\(snapshot.challengeId)")
            : URL(string: "halkora://widget-checkin/\(snapshot.challengeId)")
        )
      } else {
        VStack(spacing: 6) {
          Image(systemName: "plus.circle")
            .font(.system(size: 20))
          Text(copyTr.emptyTitle)
            .font(.system(size: 12, weight: .medium))
            .multilineTextAlignment(.center)
        }
        .foregroundStyle(.white.opacity(0.8))
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "halkora://"))
      }
    }
    .containerBackground(halkoraBg, for: .widget)
  }
}

struct HalkoraWidget: Widget {
  let kind = "HalkoraWidget"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: SelectChallengeIntent.self, provider: HalkoraProvider()) { entry in
      HalkoraWidgetView(entry: entry)
    }
    .configurationDisplayName("Halkora")
    .description("Bugünkü halkanın durumu ve tek dokunuşla check-in. Birden fazla kopya ekleyip her birini farklı bir halkaya ayarlayarak aralarında kaydırabilirsin.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct HalkoraWidgetBundle: WidgetBundle {
  var body: some Widget {
    HalkoraWidget()
  }
}
