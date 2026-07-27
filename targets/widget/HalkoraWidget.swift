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
//
// Deliberately carries the RAW day-math inputs (timezone/startDate/
// createdAt) instead of a precomputed currentDay + checkedInToday boolean:
// the app can't push an update at midnight while it isn't running, so a
// precomputed snapshot silently claimed the old day and "Yapıldı ✓" well
// into the next one (saha testi bulgusu: "tekrar uygulamaya girene kadar
// yeni güne widget geçmiyor"). currentDay/checkedIn are derived below.
private struct HalkoraSnapshot: Codable {
  var challengeId: String
  var title: String
  var totalDays: Int
  var timezone: String
  var startDate: String  // "YYYY-MM-DD" ("" only for a lobby challenge)
  var createdAt: String  // ISO — FAST_DAYS anchors its 1-minute days here
  // ExtensionStorage.set only allows string/number values inside an
  // object (no booleans) — 0/1 on the JS side.
  var fastDays: Int
  /// Which day the check-in belongs to (see dayKeyFor in src/lib/widget.ts),
  /// empty when not checked in. Compared against todayKey() below.
  var checkedInDayKey: String
  var locale: String?
}

private let isoFormatter: ISO8601DateFormatter = {
  let f = ISO8601DateFormatter()
  f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return f
}()

private func parseISO(_ s: String) -> Date? {
  isoFormatter.date(from: s) ?? ISO8601DateFormatter().date(from: s)
}

/// "YYYY-MM-DD" as seen in `timezone` — the same value
/// Intl.DateTimeFormat('en-CA', { timeZone }) produces on the JS side.
private func dateString(_ date: Date, in timezone: String) -> String {
  let f = DateFormatter()
  f.locale = Locale(identifier: "en_US_POSIX")
  f.timeZone = TimeZone(identifier: timezone) ?? .current
  f.dateFormat = "yyyy-MM-dd"
  return f.string(from: date)
}

extension HalkoraSnapshot {
  /// Mirrors dayKeyFor() in src/lib/widget.ts — keep both in sync.
  var todayKey: String {
    if fastDays != 0 { return String(currentDay) }
    return dateString(Date(), in: timezone)
  }

  /// Mirrors daysSinceStart() + `rawDay` in src/data/challenges.ts.
  var currentDay: Int {
    if fastDays != 0 {
      guard let created = parseISO(createdAt) else { return 1 }
      return Int(Date().timeIntervalSince(created) / 60) + 1
    }
    guard !startDate.isEmpty else { return 0 }
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: "UTC")
    f.dateFormat = "yyyy-MM-dd"
    guard let start = f.date(from: startDate),
      let today = f.date(from: dateString(Date(), in: timezone))
    else { return 0 }
    let diff = (today.timeIntervalSince(start) / 86_400).rounded()
    return min(Int(diff) + 1, totalDays)
  }

  var checkedInToday: Bool {
    !checkedInDayKey.isEmpty && checkedInDayKey == todayKey
  }

  /// When this snapshot's derived state can next change on its own, so the
  /// timeline can ask WidgetKit to reload exactly then instead of going
  /// stale until the app happens to run again.
  var nextRolloverDate: Date {
    if fastDays != 0 { return Date().addingTimeInterval(60) }
    let tz = TimeZone(identifier: timezone) ?? .current
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = tz
    // A minute past midnight, not exactly midnight — WidgetKit fires
    // "around" the requested date, and firing a hair early would recompute
    // the SAME day and then sit stale for another 24h.
    let tomorrow = cal.date(byAdding: .day, value: 1, to: Date()) ?? Date().addingTimeInterval(86_400)
    let midnight = cal.startOfDay(for: tomorrow)
    return midnight.addingTimeInterval(60)
  }
}

private func loadActiveChallenges() -> [HalkoraSnapshot] {
  guard let defaults = UserDefaults(suiteName: appGroup),
    let data = defaults.data(forKey: activeChallengesKey),
    let list = try? JSONDecoder().decode([HalkoraSnapshot].self, from: data)
  else { return [] }
  return list
}

// MARK: - Direct network check-in (no app open)
//
// Saha testi bulgusu: "widget direk ağdan veri çeksin, uygulamayı açmadan
// check-in yapabilmeli". The widget process can't run RN/JS or see
// supabase-js's in-memory session — src/lib/widgetAuth.ts mirrors the
// signed-in session's access/refresh token (and the public Supabase
// URL/anon key) into this same shared App Group on every auth change, so
// this extension can make its own authenticated REST calls.
//
// The trickiest part: Supabase ROTATES refresh tokens on use. If this
// widget refreshes the token while the app isn't running, the app's OWN
// in-memory refresh token becomes stale — src/hooks/useAuth.ts's
// reconcileWidgetSession() adopts whatever's newest here on every
// foreground resume specifically to paper over that.
private struct SharedAuth {
  var supabaseUrl: String
  var supabaseAnonKey: String
  var accessToken: String
  var refreshToken: String
  var expiresAt: Double  // unix seconds
}

private func loadAuth() -> SharedAuth? {
  guard let defaults = UserDefaults(suiteName: appGroup),
    let url = defaults.string(forKey: "supabaseUrl"), !url.isEmpty,
    let anonKey = defaults.string(forKey: "supabaseAnonKey"), !anonKey.isEmpty,
    let accessToken = defaults.string(forKey: "accessToken"), !accessToken.isEmpty,
    let refreshToken = defaults.string(forKey: "refreshToken"), !refreshToken.isEmpty
  else { return nil }
  let expiresAt = defaults.double(forKey: "expiresAt")
  return SharedAuth(
    supabaseUrl: url, supabaseAnonKey: anonKey, accessToken: accessToken,
    refreshToken: refreshToken, expiresAt: expiresAt)
}

private func saveRefreshedTokens(_ accessToken: String, _ refreshToken: String, _ expiresAt: Double) {
  guard let defaults = UserDefaults(suiteName: appGroup) else { return }
  defaults.set(accessToken, forKey: "accessToken")
  defaults.set(refreshToken, forKey: "refreshToken")
  defaults.set(expiresAt, forKey: "expiresAt")
}

private struct RefreshTokenResponse: Codable {
  let access_token: String
  let refresh_token: String
  let expires_in: Double
}

private func refreshAccessToken(_ auth: SharedAuth) async throws -> SharedAuth {
  var request = URLRequest(url: URL(string: "\(auth.supabaseUrl)/auth/v1/token?grant_type=refresh_token")!)
  request.httpMethod = "POST"
  request.setValue("application/json", forHTTPHeaderField: "Content-Type")
  request.setValue(auth.supabaseAnonKey, forHTTPHeaderField: "apikey")
  request.httpBody = try JSONEncoder().encode(["refresh_token": auth.refreshToken])

  let (data, response) = try await URLSession.shared.data(for: request)
  guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
    throw URLError(.userAuthenticationRequired)
  }
  let decoded = try JSONDecoder().decode(RefreshTokenResponse.self, from: data)
  let newExpiresAt = Date().timeIntervalSince1970 + decoded.expires_in
  // Written back immediately so a second CheckInIntent tap (or the app on
  // its next resume, via reconcileWidgetSession) sees the rotated token —
  // the OLD refresh token is now invalid at Supabase.
  saveRefreshedTokens(decoded.access_token, decoded.refresh_token, newExpiresAt)
  return SharedAuth(
    supabaseUrl: auth.supabaseUrl, supabaseAnonKey: auth.supabaseAnonKey,
    accessToken: decoded.access_token, refreshToken: decoded.refresh_token, expiresAt: newExpiresAt)
}

private func markCheckedInLocally(_ challengeId: String) {
  guard let defaults = UserDefaults(suiteName: appGroup),
    let data = defaults.data(forKey: activeChallengesKey),
    var list = try? JSONDecoder().decode([HalkoraSnapshot].self, from: data)
  else { return }
  guard let idx = list.firstIndex(where: { $0.challengeId == challengeId }) else { return }
  // Stamped with the day it belongs to (not a bare `true`) so it expires by
  // itself at the next rollover, exactly like the app-written value.
  list[idx].checkedInDayKey = list[idx].todayKey
  guard let newData = try? JSONEncoder().encode(list) else { return }
  defaults.set(newData, forKey: activeChallengesKey)
}

/// Calls the SAME `check-in` Edge Function src/data/checkins.ts uses
/// (day-number math + joker allowance are validated server-side there, not
/// re-implemented here) — just over a direct authenticated URLRequest
/// instead of supabase-js, since this process can't run supabase-js.
private func performCheckIn(challengeId: String) async throws {
  guard var auth = loadAuth() else { throw URLError(.userAuthenticationRequired) }

  // 60s safety margin before the token's real expiry.
  if auth.expiresAt < Date().timeIntervalSince1970 + 60 {
    auth = try await refreshAccessToken(auth)
  }

  var request = URLRequest(url: URL(string: "\(auth.supabaseUrl)/functions/v1/check-in")!)
  request.httpMethod = "POST"
  request.setValue("application/json", forHTTPHeaderField: "Content-Type")
  request.setValue("Bearer \(auth.accessToken)", forHTTPHeaderField: "Authorization")
  request.setValue(auth.supabaseAnonKey, forHTTPHeaderField: "apikey")
  request.httpBody = try JSONEncoder().encode(["challenge_id": challengeId, "type": "done"])

  let (_, response) = try await URLSession.shared.data(for: request)
  guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
    throw URLError(.badServerResponse)
  }
  // Optimistic — the widget may not reopen the app for a while, so reflect
  // "done" immediately rather than waiting for the app's next real sync.
  markCheckedInLocally(challengeId)
}

/// Bound to the not-checked-in card's Button below — runs entirely in this
/// extension's process, no app launch.
struct CheckInIntent: AppIntent {
  static var title: LocalizedStringResource = "Check-in Yap"

  @Parameter(title: "Halka ID")
  var challengeId: String

  init() {}
  init(challengeId: String) {
    self.challengeId = challengeId
  }

  func perform() async throws -> some IntentResult {
    // Silent failure by design — a widget button has no surface for an
    // error message. Worst case the row still reads "check-in yap" and the
    // next tap (or opening the app) tries again / shows the true state.
    try? await performCheckIn(challengeId: challengeId)
    WidgetCenter.shared.reloadTimelines(ofKind: "HalkoraWidget")
    return .result()
  }
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
        challengeId: "", title: "Halkora", totalDays: 30,
        timezone: TimeZone.current.identifier,
        startDate: dateString(Date().addingTimeInterval(-3 * 86_400), in: TimeZone.current.identifier),
        createdAt: "", fastDays: 0, checkedInDayKey: "", locale: "tr"))
  }

  func snapshot(for configuration: SelectChallengeIntent, in context: Context) async -> HalkoraEntry {
    HalkoraEntry(date: .now, snapshot: resolve(configuration))
  }

  func timeline(for configuration: SelectChallengeIntent, in context: Context) async -> Timeline<HalkoraEntry> {
    let all = loadActiveChallenges()

    // Explicitly configured (Edit Widget -> picked one specific halka,
    // meant for stacking several copies) -> pin to just that one, no
    // auto-rotation. Still reloads at the day boundary so the derived
    // day/checked-in state doesn't sit stale until the app next runs.
    if let pickedId = configuration.challenge?.id,
      let picked = all.first(where: { $0.challengeId == pickedId })
    {
      return Timeline(
        entries: [HalkoraEntry(date: .now, snapshot: picked)],
        policy: .after(picked.nextRolloverDate))
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
      // Reload once the rotation finishes a full pass — or at the day
      // boundary if that lands sooner, so a rollover is never waiting on a
      // long rotation to wrap around first.
      let afterFullPass = Date().addingTimeInterval(Double(all.count) * rotationInterval)
      let earliestRollover = all.map(\.nextRolloverDate).min() ?? afterFullPass
      return Timeline(entries: entries, policy: .after(min(afterFullPass, earliestRollover)))
    }

    // Zero or exactly one active challenge -> nothing to rotate through.
    guard let single = all.first(where: { !$0.checkedInToday }) ?? all.first else {
      // No active challenge at all — nothing to derive, so nothing to
      // schedule; the app's own reloadWidget() call is the only thing that
      // can meaningfully change this state.
      return Timeline(entries: [HalkoraEntry(date: .now, snapshot: nil)], policy: .never)
    }
    return Timeline(
      entries: [HalkoraEntry(date: .now, snapshot: single)],
      policy: .after(single.nextRolloverDate))
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
    return all.first(where: { !$0.checkedInToday }) ?? all.first
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
        let checkedIn = snapshot.checkedInToday
        let content = VStack(alignment: .leading, spacing: 6) {
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

        if checkedIn {
          // Nothing left to DO — tapping just opens the ring to look at it.
          content.widgetURL(URL(string: "halkora://challenge/\(snapshot.challengeId)"))
        } else {
          // The whole card IS the check-in action (iOS 17+ Button+AppIntent
          // -> runs in this extension's process, no app launch) — exactly
          // "uygulamayı açmadan check-in yapabilmeli" (saha testi bulgusu).
          Button(intent: CheckInIntent(challengeId: snapshot.challengeId)) {
            content
          }
          .buttonStyle(.plain)
        }
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
