import AppIntents
import SwiftUI
import WidgetKit

// ============================================================================
// Halkora — iOS widget family, built to docs' widget spec (the "Widget ailesi"
// PDF): small 2x2, medium 4x2, and the three Lock Screen accessories.
//
// Design rules carried over verbatim from that spec:
//  - Dark only, ONE accent (ember). Never red. A missed day looks exactly
//    like an upcoming day — this is a product principle, not an oversight.
//  - Gold is used for one thing only: a joker-covered day.
//  - Depth comes from hairline strokes, not shadows.
//  - Ring scale: small keeps discrete segments up to 16 days and falls back
//    to a continuous arc beyond that (segments thinner than ~9° turn to
//    mush); medium holds segments to 31; the Lock Screen circle to 14.
//  - Check-in confirmation has no spinner: the before/after frames differ in
//    exactly two ways — today's segment goes 32% -> solid, and the pill goes
//    ember -> settled "Yapıldı ✓" — so the system cross-fade reads as the
//    ring filling in.
//  - Tap affordance: the pill is the only button-shaped element, always
//    filled, always verb copy. Small = the whole card is the check-in
//    target. Medium = the pill is check-in (44pt hit area), the rest of the
//    card opens the halka.
// ============================================================================

// Same App Group id as app.json's ios.entitlements + this target's
// expo-target.config.js (auto-synced from the main app) — must match
// EXACTLY (case-sensitive) or this reads an empty, unrelated container.
private let appGroup = "group.com.halkora.app.widget"
private let activeChallengesKey = "activeChallenges"
private let widgetKind = "HalkoraWidget"

// MARK: - Copy
//
// Hand-maintained TR/EN, same pattern as supabase/functions/notify's COPY
// dict (docs/AGENTS.md) — a Swift widget target can't import src/i18n/*.
// Anything genuinely dynamic (a start-date label like "Pazartesi başlıyor")
// is localized by the app and passed through in the snapshot instead.

private struct WidgetCopy {
  let dayShort: (Int, Int) -> String  // "7/14"
  let dayWord: String  // "GÜN" — sits above the counter on medium
  let checkInCta: String
  let doneLabel: String
  let completedLabel: String
  let emptyTitle: String
  let emptyCta: String
  let daysCount: (Int) -> String  // "21 gün"
  let doneToday: (Int, Int) -> String  // "4/8 tamamladı"
  let jokerLeft: (Int) -> String  // "1 joker kaldı"
  let joinedCount: (Int) -> String  // "5 kişi katıldı"
  let brand: String  // inline lock-screen prefix
  let dayLong: (Int, Int) -> String  // "Gün 7/14"
}

private let copyTr = WidgetCopy(
  dayShort: { c, t in "\(c)/\(t)" },
  dayWord: "GÜN",
  checkInCta: "Check-in yap",
  doneLabel: "Yapıldı",
  completedLabel: "Tamamlandı",
  emptyTitle: "Yeni bir halka başlat",
  emptyCta: "Halka oluştur",
  daysCount: { d in "\(d) gün" },
  doneToday: { done, total in "\(done)/\(total) tamamladı" },
  jokerLeft: { n in "\(n) joker kaldı" },
  joinedCount: { n in "\(n) kişi katıldı" },
  brand: "Halka",
  dayLong: { c, t in "Gün \(c)/\(t)" }
)

private let copyEn = WidgetCopy(
  dayShort: { c, t in "\(c)/\(t)" },
  dayWord: "DAY",
  checkInCta: "Check in",
  doneLabel: "Done",
  completedLabel: "Completed",
  emptyTitle: "Start a new ring",
  emptyCta: "Create a ring",
  daysCount: { d in "\(d) days" },
  doneToday: { done, total in "\(done)/\(total) done today" },
  jokerLeft: { n in "\(n) joker left" },
  joinedCount: { n in "\(n) joined" },
  brand: "Halkora",
  dayLong: { c, t in "Day \(c)/\(t)" }
)

private func copyFor(_ locale: String?) -> WidgetCopy {
  locale == "en" ? copyEn : copyTr
}

// MARK: - Theme
//
// Mirrors src/theme/tokens.ts. Named to avoid colliding with SwiftUI's own
// `View.accentColor(_:)` modifier — a top-level constant with that exact
// name gets shadowed by the method inside a View body.
private let halkoraEmber = Color(red: 1.0, green: 0.42, blue: 0.28)  // #FF6B47
private let halkoraJoker = Color(red: 0.878, green: 0.702, blue: 0.298)  // #E0B34C
private let halkoraWaiting = Color(red: 0.227, green: 0.247, blue: 0.290)  // #3A3F4A
private let halkoraBg = Color(red: 0.051, green: 0.055, blue: 0.067)  // #0D0E11
private let halkoraTextPrimary = Color(red: 0.957, green: 0.961, blue: 0.969)  // #F4F5F7
private let halkoraTextSecondary = Color(red: 0.604, green: 0.627, blue: 0.675)  // #9AA0AC
private let halkoraTextTertiary = Color(red: 0.365, green: 0.388, blue: 0.439)  // #5D6370

// The spec's W/* type scale. The .ttf files live alongside this file and are
// registered in this target's Info.plist (UIAppFonts) — a widget extension
// has its own bundle and does NOT inherit the app's registered fonts.
private func wTitle(_ size: CGFloat = 13) -> Font { .custom("GeneralSans-Semibold", size: size) }
private func wCounter(_ size: CGFloat) -> Font { .custom("GeneralSans-Semibold", size: size) }
private func wAction(_ size: CGFloat = 12) -> Font { .custom("Satoshi-Medium", size: size) }
private func wMeta(_ size: CGFloat = 11) -> Font { .custom("Satoshi-Medium", size: size) }
private func wButton(_ size: CGFloat = 12) -> Font { .custom("Satoshi-Bold", size: size) }

// MARK: - Snapshot model

/// Mirrors one element of the array src/lib/widget.ts writes via
/// ExtensionStorage.set — keep field names/types in sync with that file.
///
/// Deliberately carries the RAW day-math inputs (timezone/startDate/
/// createdAt) instead of a precomputed day + checked-in boolean: the app
/// can't push an update at midnight while it isn't running, so a
/// precomputed snapshot silently claimed the old day well into the next one.
private struct HalkoraSnapshot: Codable {
  var challengeId: String
  var title: String
  var dailyAction: String
  var totalDays: Int
  var timezone: String
  var startDate: String  // "YYYY-MM-DD" ("" for a lobby challenge)
  var createdAt: String  // ISO — FAST_DAYS anchors its 1-minute days here
  // ExtensionStorage.set only allows string/number values inside an object
  // (no booleans) — 0/1 on the JS side.
  var fastDays: Int
  /// Which day the check-in belongs to; empty when not checked in.
  var checkedInDayKey: String
  /// One char per day: 'd' done, 'j' joker, '-' everything else (missed and
  /// upcoming are intentionally identical).
  var segments: String
  /// The day the group counts below were taken on — they're hidden rather
  /// than shown stale once this no longer matches today.
  var syncedDayKey: String
  var participantsTotal: Int
  var participantsDoneToday: Int
  var jokerRemaining: Int
  var state: String  // "active" | "upcoming" | "lobby"
  var startsLabel: String  // already localized by the app
  var locale: String?
}

private func loadActiveChallenges() -> [HalkoraSnapshot] {
  guard let defaults = UserDefaults(suiteName: appGroup),
    let data = defaults.data(forKey: activeChallengesKey),
    let list = try? JSONDecoder().decode([HalkoraSnapshot].self, from: data)
  else { return [] }
  return list
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

/// What a single ring segment should look like.
private enum SegmentKind {
  case done
  case joker
  case today
  case waiting
}

extension HalkoraSnapshot {
  var isActive: Bool { state == "active" }
  var isLobby: Bool { state == "lobby" }

  /// Mirrors dayKeyFor() in src/lib/widget.ts — keep both in sync.
  var todayKey: String {
    if fastDays != 0 { return String(currentDay) }
    return dateString(Date(), in: timezone)
  }

  /// Mirrors daysSinceStart() + `rawDay` in src/data/challenges.ts.
  var currentDay: Int {
    if fastDays != 0 {
      guard let created = parseISO(createdAt) else { return 1 }
      return min(Int(Date().timeIntervalSince(created) / 60) + 1, totalDays)
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

  /// True once the last day is behind us — drives the "Tamamlandı" frame.
  var isCompleted: Bool { isActive && currentDay >= totalDays && checkedInToday }

  /// Group counts only make sense for the day they were counted on.
  var groupCountsFresh: Bool { syncedDayKey == todayKey }

  /// Per-day ring state, with today's segment resolved live rather than
  /// trusting whatever the app last stored.
  var ringSegments: [SegmentKind] {
    let chars = Array(segments)
    let day = currentDay
    return (1...max(totalDays, 1)).map { n in
      if n == day && isActive {
        return checkedInToday ? .done : .today
      }
      guard n - 1 < chars.count else { return .waiting }
      switch chars[n - 1] {
      case "d": return .done
      case "j": return .joker
      default: return .waiting
      }
    }
  }

  /// When the derived state can next change on its own, so the timeline can
  /// reload exactly then instead of going stale until the app runs again.
  var nextRolloverDate: Date {
    if fastDays != 0 { return Date().addingTimeInterval(60) }
    let tz = TimeZone(identifier: timezone) ?? .current
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = tz
    // A minute past midnight, not exactly midnight — WidgetKit fires
    // "around" the requested date, and firing a hair early would recompute
    // the SAME day and then sit stale for another 24h.
    let tomorrow = cal.date(byAdding: .day, value: 1, to: Date()) ?? Date().addingTimeInterval(86_400)
    return cal.startOfDay(for: tomorrow).addingTimeInterval(60)
  }
}

// MARK: - Direct network check-in (no app open)
//
// The widget process can't run RN/JS or see supabase-js's in-memory session
// — src/lib/widgetAuth.ts mirrors the signed-in session's tokens (and the
// public Supabase URL/anon key) into this same shared App Group so this
// extension can make its own authenticated REST calls.
//
// The trickiest part: Supabase ROTATES refresh tokens on use. If this widget
// refreshes while the app isn't running, the app's OWN in-memory refresh
// token goes stale — src/hooks/useAuth.ts's reconcileWidgetSession() adopts
// whatever's newest here on every foreground resume to paper over that.

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
  return SharedAuth(
    supabaseUrl: url, supabaseAnonKey: anonKey, accessToken: accessToken,
    refreshToken: refreshToken, expiresAt: defaults.double(forKey: "expiresAt"))
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
  var request = URLRequest(
    url: URL(string: "\(auth.supabaseUrl)/auth/v1/token?grant_type=refresh_token")!)
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
  // Written back immediately so a second tap (or the app on its next resume,
  // via reconcileWidgetSession) sees the rotated token — the OLD refresh
  // token is now invalid at Supabase.
  saveRefreshedTokens(decoded.access_token, decoded.refresh_token, newExpiresAt)
  return SharedAuth(
    supabaseUrl: auth.supabaseUrl, supabaseAnonKey: auth.supabaseAnonKey,
    accessToken: decoded.access_token, refreshToken: decoded.refresh_token,
    expiresAt: newExpiresAt)
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
  // Keep the group counter honest about the check-in that just happened.
  if list[idx].groupCountsFresh {
    list[idx].participantsDoneToday = min(
      list[idx].participantsDoneToday + 1, list[idx].participantsTotal)
  }
  guard let newData = try? JSONEncoder().encode(list) else { return }
  defaults.set(newData, forKey: activeChallengesKey)
}

/// Calls the SAME `check-in` Edge Function src/data/checkins.ts uses (day
/// math + joker allowance stay validated server-side there, not
/// reimplemented here) — just over a direct authenticated URLRequest, since
/// this process can't run supabase-js.
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
  markCheckedInLocally(challengeId)
}

/// Bound to the check-in pill/card — runs entirely in this extension's
/// process, no app launch.
struct CheckInIntent: AppIntent {
  static var title: LocalizedStringResource = "Check-in Yap"

  @Parameter(title: "Halka ID")
  var challengeId: String

  init() {}
  init(challengeId: String) { self.challengeId = challengeId }

  func perform() async throws -> some IntentResult {
    // Silent failure by design — a widget button has no surface for an error
    // message. Worst case the card still reads "Check-in yap" and the next
    // tap (or opening the app) tries again / shows the true state.
    try? await performCheckIn(challengeId: challengeId)
    // All kinds, not just the one that was tapped — small, medium and the
    // Lock Screen accessories are separate timelines showing the same
    // check-in state, and leaving the others stale is exactly the bug this
    // widget already had once.
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}

// MARK: - Per-instance configuration

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
  /// How many halkalar this widget is rotating through, and which one this
  /// entry is — drives the near-invisible page dots (spec 03). 1 == no dots.
  let rotationCount: Int
  let rotationIndex: Int
}

struct HalkoraProvider: AppIntentTimelineProvider {
  typealias Intent = SelectChallengeIntent
  typealias Entry = HalkoraEntry

  func placeholder(in context: Context) -> HalkoraEntry {
    HalkoraEntry(date: .now, snapshot: samplePreview, rotationCount: 1, rotationIndex: 0)
  }

  func snapshot(for configuration: SelectChallengeIntent, in context: Context) async -> HalkoraEntry {
    // The "Add Widget" gallery must always show the idealized frame — short
    // title, day 7/14, pending check-in — the state the widget was designed
    // around. Never empty, never redacted, never a long title (spec:
    // "Preview sample data rules").
    if context.isPreview {
      return HalkoraEntry(date: .now, snapshot: samplePreview, rotationCount: 1, rotationIndex: 0)
    }
    return HalkoraEntry(
      date: .now, snapshot: resolve(configuration), rotationCount: 1, rotationIndex: 0)
  }

  func timeline(for configuration: SelectChallengeIntent, in context: Context) async -> Timeline<HalkoraEntry> {
    let all = loadActiveChallenges()

    // Explicitly configured (Edit Widget -> picked one specific halka, meant
    // for stacking several copies) -> pin to just that one, no rotation.
    if let pickedId = configuration.challenge?.id,
      let picked = all.first(where: { $0.challengeId == pickedId })
    {
      return Timeline(
        entries: [HalkoraEntry(date: .now, snapshot: picked, rotationCount: 1, rotationIndex: 0)],
        policy: .after(picked.nextRolloverDate))
    }

    // Unconfigured + more than one halka -> auto-rotate. A Timeline can
    // carry several future-dated entries in one go; WidgetKit switches
    // between them locally as each date arrives, so only the one
    // timeline(for:) call counts against the refresh budget, not each
    // switch. Capped at 3 (matching the spec's "max 3 dots").
    if all.count > 1 {
      let rotationInterval: TimeInterval = 15 * 60
      let shown = Array(all.prefix(3))
      let entries = shown.enumerated().map { index, snapshot in
        HalkoraEntry(
          date: Date().addingTimeInterval(Double(index) * rotationInterval),
          snapshot: snapshot, rotationCount: shown.count, rotationIndex: index)
      }
      // Reload once the rotation finishes a pass — or at the day boundary if
      // that lands sooner, so a rollover never waits on the rotation to wrap.
      let afterFullPass = Date().addingTimeInterval(Double(shown.count) * rotationInterval)
      let earliestRollover = shown.map(\.nextRolloverDate).min() ?? afterFullPass
      return Timeline(entries: entries, policy: .after(min(afterFullPass, earliestRollover)))
    }

    guard let single = all.first(where: { !$0.checkedInToday }) ?? all.first else {
      // No halka at all — nothing to derive, so nothing to schedule; the
      // app's own reloadWidget() is the only thing that can change this.
      return Timeline(
        entries: [HalkoraEntry(date: .now, snapshot: nil, rotationCount: 1, rotationIndex: 0)],
        policy: .never)
    }
    return Timeline(
      entries: [HalkoraEntry(date: .now, snapshot: single, rotationCount: 1, rotationIndex: 0)],
      policy: .after(single.nextRolloverDate))
  }

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

/// The idealized gallery frame (spec: "Preview sample data rules").
private let samplePreview = HalkoraSnapshot(
  challengeId: "", title: "Sabah 06:30 Kulübü", dailyAction: "06:30'da kalk",
  totalDays: 14, timezone: TimeZone.current.identifier,
  startDate: dateString(Date().addingTimeInterval(-6 * 86_400), in: TimeZone.current.identifier),
  createdAt: "", fastDays: 0, checkedInDayKey: "",
  segments: "dddddd--------", syncedDayKey: "", participantsTotal: 8,
  participantsDoneToday: 4, jokerRemaining: 1, state: "active", startsLabel: "",
  locale: "tr")

// MARK: - Ring

/// The segmented ring. Falls back to a single continuous arc once the
/// segments would be thinner than the spec's readable minimum — small holds
/// 16 days, medium 31, the Lock Screen circle 14.
private struct RingView: View {
  let segments: [SegmentKind]
  let lineWidth: CGFloat
  let maxSegments: Int
  /// Lock Screen accessories are rendered monochrome by the system; colors
  /// there are meaningless, so we express state as opacity instead.
  var monochrome: Bool = false

  private func color(_ kind: SegmentKind) -> Color {
    if monochrome {
      // Spec: done 100%, today 45%, waiting/missed 28%. The joker
      // distinction is deliberately dropped here — with color stripped it
      // reads as done, which is the honest lock-screen summary.
      switch kind {
      case .done, .joker: return .white
      case .today: return .white.opacity(0.45)
      case .waiting: return .white.opacity(0.28)
      }
    }
    switch kind {
    case .done: return halkoraEmber
    case .joker: return halkoraJoker
    // 32% today, solid once checked in — half of the two-part check-in
    // confirmation (the pill is the other half).
    case .today: return halkoraEmber.opacity(0.32)
    case .waiting: return halkoraWaiting
    }
  }

  private var doneFraction: Double {
    guard !segments.isEmpty else { return 0 }
    let filled = segments.filter { $0 == .done || $0 == .joker }.count
    return Double(filled) / Double(segments.count)
  }

  var body: some View {
    ZStack {
      if segments.count <= maxSegments {
        ForEach(Array(segments.enumerated()), id: \.offset) { index, kind in
          let slice = 360.0 / Double(segments.count)
          // A small gap between segments; kept proportional so a 14-day ring
          // and a 4-day ring both read as "segments", not as a dashed line.
          let gap = min(slice * 0.22, 5.0)
          Circle()
            .trim(
              from: (Double(index) * slice + gap / 2) / 360,
              to: ((Double(index) + 1) * slice - gap / 2) / 360
            )
            .stroke(color(kind), style: StrokeStyle(lineWidth: lineWidth, lineCap: .butt))
            .rotationEffect(.degrees(-90))
        }
      } else {
        // Continuous-arc fallback: the numeric counter in the middle is what
        // carries the precision at this density.
        Circle()
          .stroke(color(.waiting), style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
        Circle()
          .trim(from: 0, to: doneFraction)
          .stroke(
            monochrome ? .white : halkoraEmber,
            style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
          )
          .rotationEffect(.degrees(-90))
      }
    }
  }
}

// MARK: - Shared pieces

/// The one button-shaped element in the layout: always filled, always verb
/// copy (spec: "Tap affordance").
private struct Pill: View {
  let label: String
  var settled: Bool = false

  var body: some View {
    Text(label)
      .font(wButton())
      .foregroundStyle(settled ? halkoraTextSecondary : halkoraEmber)
      .padding(.horizontal, 14)
      .padding(.vertical, 7)
      .frame(maxWidth: .infinity)
      .background(
        Capsule().fill(settled ? Color.white.opacity(0.04) : halkoraEmber.opacity(0.14))
      )
      .overlay(
        Capsule().stroke(
          settled ? Color.white.opacity(0.06) : halkoraEmber.opacity(0.35), lineWidth: 0.5)
      )
  }
}

/// Near-invisible rotation dots (spec 03). Never more than three.
private struct RotationDots: View {
  let count: Int
  let index: Int

  var body: some View {
    HStack(spacing: 3) {
      ForEach(0..<count, id: \.self) { i in
        Circle()
          .fill(Color.white.opacity(i == index ? 0.35 : 0.12))
          .frame(width: 3, height: 3)
      }
    }
  }
}

private func doneLabelWithCheck(_ text: String) -> some View {
  HStack(spacing: 3) {
    Text(text)
    // SF Symbol rather than a text glyph — a "✓" character renders at a
    // different weight/baseline than the surrounding Satoshi.
    Image(systemName: "checkmark").font(.system(size: 9, weight: .bold))
  }
}

// MARK: - Small (2x2)

struct HalkoraSmallView: View {
  var entry: HalkoraEntry

  var body: some View {
    Group {
      if let s = entry.snapshot {
        let c = copyFor(s.locale)
        content(s, c)
      } else {
        emptyState(copyFor(nil))
      }
    }
    .containerBackground(halkoraBg, for: .widget)
  }

  @ViewBuilder
  private func content(_ s: HalkoraSnapshot, _ c: WidgetCopy) -> some View {
    let card = VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .top) {
        ZStack {
          RingView(segments: s.ringSegments, lineWidth: 5, maxSegments: 16)
            .frame(width: 56, height: 56)
          if s.isActive {
            Text(c.dayShort(s.currentDay, s.totalDays))
              .font(wCounter(13))
              .monospacedDigit()
              .foregroundStyle(halkoraTextPrimary)
          } else {
            // Not started yet: no day to count, so the length of the
            // commitment is the useful number instead.
            Text(c.daysCount(s.totalDays))
              .font(wMeta(10))
              .foregroundStyle(halkoraTextSecondary)
          }
        }
        Spacer(minLength: 0)
        if entry.rotationCount > 1 {
          RotationDots(count: entry.rotationCount, index: entry.rotationIndex)
            .padding(.top, 4)
        }
      }

      Spacer(minLength: 6)

      Text(s.title)
        .font(wTitle())
        .kerning(-0.26)
        .foregroundStyle(halkoraTextPrimary)
        .lineLimit(2)
        .multilineTextAlignment(.leading)
        .fixedSize(horizontal: false, vertical: true)

      Spacer(minLength: 6)

      if s.isActive {
        if s.isCompleted {
          Pill(label: c.completedLabel, settled: true)
        } else if s.checkedInToday {
          Pill(label: c.doneLabel, settled: true)
        } else {
          Pill(label: c.checkInCta)
        }
      } else {
        // Nothing to do yet — the spec deliberately drops the pill here
        // rather than showing a disabled one.
        VStack(alignment: .leading, spacing: 1) {
          if !s.startsLabel.isEmpty {
            Text(s.startsLabel).font(wMeta()).foregroundStyle(halkoraTextSecondary)
          }
          Text(c.joinedCount(s.participantsTotal))
            .font(wMeta())
            .monospacedDigit()
            .foregroundStyle(halkoraTextTertiary)
        }
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

    // Spec: on small, the WHOLE card is the check-in target; the pill exists
    // as affordance only. Anything not actionable just opens the halka.
    if s.isActive && !s.checkedInToday && !s.isCompleted {
      Button(intent: CheckInIntent(challengeId: s.challengeId)) { card }
        .buttonStyle(.plain)
    } else {
      card.widgetURL(URL(string: "halkora://challenge/\(s.challengeId)"))
    }
  }

  private func emptyState(_ c: WidgetCopy) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      // The empty state keeps the ring — the motif is the brand.
      ZStack {
        RingView(segments: Array(repeating: .waiting, count: 12), lineWidth: 5, maxSegments: 16)
          .frame(width: 56, height: 56)
        Image(systemName: "plus").font(.system(size: 15, weight: .semibold))
          .foregroundStyle(halkoraEmber)
      }
      Spacer(minLength: 6)
      Text(c.emptyTitle)
        .font(wTitle())
        .kerning(-0.26)
        .foregroundStyle(halkoraTextPrimary)
        .lineLimit(2)
        .fixedSize(horizontal: false, vertical: true)
      Spacer(minLength: 6)
      Pill(label: c.emptyCta)
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .widgetURL(URL(string: "halkora://"))
  }
}

struct HalkoraSmallWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(
      kind: widgetKind, intent: SelectChallengeIntent.self, provider: HalkoraProvider()
    ) { entry in
      HalkoraSmallView(entry: entry)
    }
    .configurationDisplayName("Halka")
    .description("Günün check-in'i ve halkanın ilerlemesi, tek bakışta.")
    .supportedFamilies([.systemSmall])
  }
}

// MARK: - Medium (4x2)

struct HalkoraMediumView: View {
  var entry: HalkoraEntry

  var body: some View {
    Group {
      if let s = entry.snapshot {
        content(s, copyFor(s.locale))
      } else {
        emptyState(copyFor(nil))
      }
    }
    .containerBackground(halkoraBg, for: .widget)
  }

  @ViewBuilder
  private func content(_ s: HalkoraSnapshot, _ c: WidgetCopy) -> some View {
    HStack(alignment: .center, spacing: 16) {
      ZStack {
        RingView(segments: s.ringSegments, lineWidth: 7, maxSegments: 31)
          .frame(width: 88, height: 88)
        VStack(spacing: 0) {
          if s.isActive {
            Text(c.dayWord)
              .font(wMeta(9))
              .kerning(1.2)
              .foregroundStyle(halkoraTextTertiary)
            Text(c.dayShort(s.currentDay, s.totalDays))
              .font(wCounter(16))
              .monospacedDigit()
              .foregroundStyle(halkoraTextPrimary)
          } else {
            Text(c.daysCount(s.totalDays))
              .font(wMeta(11))
              .foregroundStyle(halkoraTextSecondary)
          }
        }
      }

      VStack(alignment: .leading, spacing: 0) {
        HStack(alignment: .top) {
          VStack(alignment: .leading, spacing: 2) {
            Text(s.title)
              .font(wTitle(14))
              .kerning(-0.28)
              .foregroundStyle(halkoraTextPrimary)
              .lineLimit(2)
              .fixedSize(horizontal: false, vertical: true)
            if !s.dailyAction.isEmpty {
              Text(s.dailyAction)
                .font(wAction())
                .foregroundStyle(halkoraTextSecondary)
                .lineLimit(1)
            }
          }
          Spacer(minLength: 0)
          if entry.rotationCount > 1 {
            RotationDots(count: entry.rotationCount, index: entry.rotationIndex)
              .padding(.top, 3)
          }
        }

        Spacer(minLength: 8)

        HStack(alignment: .bottom) {
          VStack(alignment: .leading, spacing: 2) {
            if s.isActive {
              if s.groupCountsFresh {
                Text(c.doneToday(s.participantsDoneToday, s.participantsTotal))
                  .font(wMeta())
                  .monospacedDigit()
                  .foregroundStyle(halkoraTextSecondary)
              }
              if s.jokerRemaining > 0 {
                HStack(spacing: 4) {
                  Circle().fill(halkoraJoker).frame(width: 5, height: 5)
                  Text(c.jokerLeft(s.jokerRemaining))
                    .font(wMeta())
                    .monospacedDigit()
                    .foregroundStyle(halkoraTextSecondary)
                }
              }
            } else {
              if !s.startsLabel.isEmpty {
                Text(s.startsLabel).font(wMeta()).foregroundStyle(halkoraTextSecondary)
              }
              Text(c.joinedCount(s.participantsTotal))
                .font(wMeta())
                .monospacedDigit()
                .foregroundStyle(halkoraTextTertiary)
            }
          }

          Spacer(minLength: 8)

          // Spec: two targets on medium — the pill is check-in (44pt hit
          // area around a 32pt pill), the rest of the card opens the halka.
          if s.isActive {
            if s.isCompleted {
              Pill(label: c.completedLabel, settled: true).fixedSize()
            } else if s.checkedInToday {
              Pill(label: c.doneLabel, settled: true).fixedSize()
            } else {
              Button(intent: CheckInIntent(challengeId: s.challengeId)) {
                Pill(label: c.checkInCta)
                  .fixedSize()
                  .frame(minHeight: 44)
              }
              .buttonStyle(.plain)
            }
          }
        }
      }
    }
    .padding(16)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .widgetURL(URL(string: "halkora://challenge/\(s.challengeId)"))
  }

  private func emptyState(_ c: WidgetCopy) -> some View {
    HStack(spacing: 16) {
      ZStack {
        RingView(segments: Array(repeating: .waiting, count: 12), lineWidth: 7, maxSegments: 31)
          .frame(width: 88, height: 88)
        Image(systemName: "plus").font(.system(size: 20, weight: .semibold))
          .foregroundStyle(halkoraEmber)
      }
      VStack(alignment: .leading, spacing: 6) {
        Text(c.emptyTitle)
          .font(wTitle(14))
          .kerning(-0.28)
          .foregroundStyle(halkoraTextPrimary)
          .fixedSize(horizontal: false, vertical: true)
        Pill(label: c.emptyCta).fixedSize()
      }
      Spacer(minLength: 0)
    }
    .padding(16)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .widgetURL(URL(string: "halkora://"))
  }
}

struct HalkoraMediumWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(
      kind: "HalkoraWidgetMedium", intent: SelectChallengeIntent.self, provider: HalkoraProvider()
    ) { entry in
      HalkoraMediumView(entry: entry)
    }
    .configurationDisplayName("Halka · detay")
    .description("Günlük hedef, grup ilerlemesi ve joker durumu.")
    .supportedFamilies([.systemMedium])
  }
}

// MARK: - Lock Screen accessories
//
// The system renders these monochrome (white on transparent) — color is
// stripped, so state is expressed through opacity, shape and weight only.

struct HalkoraLockView: View {
  @Environment(\.widgetFamily) var family
  var entry: HalkoraEntry

  var body: some View {
    Group {
      switch family {
      case .accessoryCircular:
        circular
      case .accessoryRectangular:
        rectangular
      default:
        inline
      }
    }
    .widgetURL(
      URL(
        string: entry.snapshot.map { "halkora://challenge/\($0.challengeId)" } ?? "halkora://"))
  }

  @ViewBuilder
  private var circular: some View {
    if let s = entry.snapshot {
      ZStack {
        AccessoryWidgetBackground()
        RingView(segments: s.ringSegments, lineWidth: 4, maxSegments: 14, monochrome: true)
        // Day number while pending; a check once done.
        if s.checkedInToday {
          Image(systemName: "checkmark").font(.system(size: 14, weight: .bold))
        } else if s.isActive {
          Text("\(s.currentDay)").font(.system(size: 15, weight: .semibold)).monospacedDigit()
        } else {
          Text("\(s.totalDays)").font(.system(size: 13, weight: .medium)).monospacedDigit()
        }
      }
    } else {
      ZStack {
        AccessoryWidgetBackground()
        Image(systemName: "circle.dashed").font(.system(size: 16, weight: .regular))
      }
    }
  }

  @ViewBuilder
  private var rectangular: some View {
    if let s = entry.snapshot {
      let c = copyFor(s.locale)
      VStack(alignment: .leading, spacing: 3) {
        Text(s.title).font(.system(size: 13, weight: .semibold)).lineLimit(1)
        // The ring flattens to a tick bar — same segments, read left to right.
        TickBar(segments: s.ringSegments)
          .frame(height: 4)
        HStack(spacing: 4) {
          Text(c.dayLong(s.currentDay, s.totalDays)).monospacedDigit()
          Text("·")
          if s.checkedInToday {
            doneLabelWithCheck(c.doneLabel)
          } else {
            Text(c.checkInCta)
          }
        }
        .font(.system(size: 12, weight: .regular))
        .opacity(0.75)
        .lineLimit(1)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    } else {
      Text(copyFor(nil).emptyTitle).font(.system(size: 13, weight: .semibold))
    }
  }

  @ViewBuilder
  private var inline: some View {
    if let s = entry.snapshot {
      let c = copyFor(s.locale)
      // One line, mini arc as the brand mark.
      Label {
        if s.checkedInToday {
          Text("\(c.brand) · \(c.doneLabel) ✓")
        } else {
          Text("\(c.brand) · \(c.dayLong(s.currentDay, s.totalDays))")
        }
      } icon: {
        Image(systemName: s.checkedInToday ? "circle.righthalf.filled" : "circle.dashed")
      }
    } else {
      Label(copyFor(nil).brand, systemImage: "circle.dashed")
    }
  }
}

/// The Lock Screen rectangular flattening of the ring: one tick per day,
/// same three opacity steps as the circular ring.
private struct TickBar: View {
  let segments: [SegmentKind]

  var body: some View {
    GeometryReader { geo in
      let count = max(segments.count, 1)
      let spacing: CGFloat = count > 24 ? 1 : 2
      let tick = max((geo.size.width - spacing * CGFloat(count - 1)) / CGFloat(count), 1)
      HStack(spacing: spacing) {
        ForEach(Array(segments.enumerated()), id: \.offset) { _, kind in
          Capsule()
            .fill(
              Color.white.opacity(
                kind == .done || kind == .joker ? 1.0 : (kind == .today ? 0.45 : 0.28))
            )
            .frame(width: tick)
        }
      }
    }
  }
}

struct HalkoraLockWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(
      kind: "HalkoraWidgetLock", intent: SelectChallengeIntent.self, provider: HalkoraProvider()
    ) { entry in
      HalkoraLockView(entry: entry)
    }
    .configurationDisplayName("Halka · kilit ekranı")
    .description("Halkanın günü ve check-in durumu.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

// MARK: - Bundle

@main
struct HalkoraWidgetBundle: WidgetBundle {
  var body: some Widget {
    HalkoraSmallWidget()
    HalkoraMediumWidget()
    HalkoraLockWidget()
  }
}
