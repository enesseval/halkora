import SwiftUI
import WidgetKit

// Same App Group id as app.json's ios.entitlements + this target's
// expo-target.config.js (auto-synced from the main app) — must match
// EXACTLY (case-sensitive) or this reads an empty, unrelated container.
private let appGroup = "group.com.halkora.app.widget"
private let snapshotKey = "snapshot"

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

// Mirrors the object src/lib/widget.ts writes via ExtensionStorage.set —
// keep the field names/types in sync with that file.
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

private func loadSnapshot() -> HalkoraSnapshot? {
  guard let defaults = UserDefaults(suiteName: appGroup),
    let data = defaults.data(forKey: snapshotKey)
  else { return nil }
  return try? JSONDecoder().decode(HalkoraSnapshot.self, from: data)
}

struct HalkoraEntry: TimelineEntry {
  let date: Date
  let snapshot: HalkoraSnapshot?
}

struct HalkoraProvider: TimelineProvider {
  func placeholder(in context: Context) -> HalkoraEntry {
    HalkoraEntry(
      date: .now,
      snapshot: HalkoraSnapshot(
        challengeId: "", title: "Halkora", currentDay: 4, totalDays: 30,
        checkedInToday: 0, locale: "tr"))
  }

  func getSnapshot(in context: Context, completion: @escaping (HalkoraEntry) -> Void) {
    completion(HalkoraEntry(date: .now, snapshot: loadSnapshot()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<HalkoraEntry>) -> Void) {
    let entry = HalkoraEntry(date: .now, snapshot: loadSnapshot())
    // The app calls ExtensionStorage.reloadWidget() after every relevant
    // change (check-in, challenge list refresh) — .never means this relies
    // entirely on that in-app push instead of guessing a poll interval and
    // burning through WidgetKit's limited daily refresh budget.
    completion(Timeline(entries: [entry], policy: .never))
  }
}

private let accentColor = Color(red: 1.0, green: 0.42, blue: 0.28)
private let backgroundColor = Color(red: 0.051, green: 0.055, blue: 0.067)

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
          .foregroundStyle(checkedIn ? accentColor : .white)
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        // A single tap target for the whole small widget: if today's
        // already done, just open the ring; otherwise route through the
        // auto-check-in screen (app/widget-checkin/[id].tsx) — true
        // no-app-open check-in needs an iOS 17 AppIntent + native network
        // call, saved for a later round (docs/ROADMAP.md).
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
    .containerBackground(backgroundColor, for: .widget)
  }
}

struct HalkoraWidget: Widget {
  let kind = "HalkoraWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: HalkoraProvider()) { entry in
      HalkoraWidgetView(entry: entry)
    }
    .configurationDisplayName("Halkora")
    .description("Bugünkü halkanın durumu ve tek dokunuşla check-in.")
    .supportedFamilies([.systemSmall])
  }
}

@main
struct HalkoraWidgetBundle: WidgetBundle {
  var body: some Widget {
    HalkoraWidget()
  }
}
