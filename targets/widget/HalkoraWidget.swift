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
  // "Bugün" ve "Seri" widget'ları
  let todayTitle: String  // "Bugün"
  /// Header when NOTHING is running yet — every ring is still upcoming. Saying
  /// "Bugün" above a row that reads "Yarın başlıyor" stamps a day onto a ring
  /// that hasn't got one (saha testi bulgusu). Matches the app's own "YAKINDA"
  /// section on Home.
  let soonTitle: String  // "Yakında"
  let ringsClosed: (Int, Int) -> String  // "2/3 halka kapandı"
  let allClosed: String  // "Bugün tamam"
  let noneActive: String  // "Aktif halka yok"
  let streakUnit: (Int) -> String  // "7 gün seri"
  let streakWord: String  // "SERİ"
  // Smart Mode (Faz 2 §2.5)
  let yourTurn: String  // "Sıra sende"
  let waitingOn: (String) -> String  // "Ayşe ve Mert bekliyor"
  let waitingOnMore: (String, Int) -> String  // "Ayşe, Mert +3"
  let streakAtRisk: (Int) -> String  // "Seri riskte · 2 halka kaldı"
  let hoursLeft: (Int) -> String  // "3 saat kaldı"
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
  dayLong: { c, t in "Gün \(c)/\(t)" },
  todayTitle: "Bugün",
  soonTitle: "Yakında",
  ringsClosed: { done, total in "\(done)/\(total) halka kapandı" },
  allClosed: "Bugün tamam",
  noneActive: "Aktif halka yok",
  streakUnit: { n in "\(n) gün seri" },
  streakWord: "SERİ",
  yourTurn: "Sıra sende",
  waitingOn: { names in "\(names) bekliyor" },
  waitingOnMore: { names, more in "\(names) +\(more) bekliyor" },
  streakAtRisk: { n in n == 1 ? "Seri riskte · 1 halka kaldı" : "Seri riskte · \(n) halka kaldı" },
  hoursLeft: { h in h <= 1 ? "1 saatten az" : "\(h) saat kaldı" }
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
  dayLong: { c, t in "Day \(c)/\(t)" },
  todayTitle: "Today",
  soonTitle: "Soon",
  ringsClosed: { done, total in "\(done)/\(total) rings closed" },
  allClosed: "Today is done",
  noneActive: "No active rings",
  streakUnit: { n in "\(n) day streak" },
  streakWord: "STREAK",
  yourTurn: "It's on you",
  waitingOn: { names in "waiting on \(names)" },
  waitingOnMore: { names, more in "waiting on \(names) +\(more)" },
  streakAtRisk: { n in n == 1 ? "Streak at risk · 1 ring left" : "Streak at risk · \(n) rings left" },
  hoursLeft: { h in h <= 1 ? "under an hour" : "\(h)h left" }
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
/// deadlineTime) instead of a precomputed day + checked-in boolean: the app
/// can't push an update at midnight while it isn't running, so a
/// precomputed snapshot silently claimed the old day well into the next one.
private struct HalkoraSnapshot: Codable {
  var challengeId: String
  var title: String
  var dailyAction: String
  var totalDays: Int
  var timezone: String
  /// "HH:MM" — when the day closes in this ring's timezone. Optional so a
  /// snapshot written before deadlines existed still decodes; absent means
  /// midnight, i.e. the plain calendar day.
  var deadlineTime: String?
  var startDate: String  // "YYYY-MM-DD" ("" for a lobby challenge)
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
  /// "AB:1,CD:0" — initials and whether that person covered today. Packed
  /// into one string for the same reason `segments` is (ExtensionStorage
  /// takes only strings/numbers inside an object). Optional so a snapshot
  /// written by an older build still decodes.
  var roster: String?
  /// Faz 2 §2.3 — everyone else has closed today. 0/1 because ExtensionStorage
  /// won't carry booleans. Optional so an older snapshot still decodes.
  var userIsLast: Int?
  /// Up to two names the ring is still waiting on, comma-separated.
  var pendingNames: String?
  var jokerRemaining: Int
  var state: String  // "active" | "upcoming" | "lobby"
  var startsLabel: String  // already localized by the app
  var locale: String?
}

/// Leaves a mark saying a widget of ours actually rendered.
///
/// The app reads this to know whether to offer its "put this on your Lock
/// Screen" hint (Faz 2 §2.6). WidgetKit's own getCurrentConfigurations is
/// only reachable from native code the app doesn't have, and a whole native
/// module to answer one boolean isn't worth it — the widget already shares a
/// container with the app, so it can simply say so itself.
private func markWidgetAlive() {
  UserDefaults(suiteName: appGroup)?.set(Date().timeIntervalSince1970, forKey: "widgetSeenAt")
}

private func loadActiveChallenges() -> [HalkoraSnapshot] {
  markWidgetAlive()
  guard let defaults = UserDefaults(suiteName: appGroup),
    let data = defaults.data(forKey: activeChallengesKey),
    let list = try? JSONDecoder().decode([HalkoraSnapshot].self, from: data)
  else { return [] }
  return list
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

// Everything derived below takes the date it should be evaluated AT, rather
// than reading Date() internally. That's what lets one timeline carry
// several future-dated entries whose state is already correct when WidgetKit
// displays them — the system flips between pre-built entries locally, for
// free, instead of us asking it to reload at every day boundary.
//
// ⚠️ Asking for frequent reloads does NOT work: WidgetKit grants a widget
// only a few dozen refreshes a day, so a "reload me in 60 seconds" policy is
// silently throttled and the widget just freezes (saha testi bulgusu:
// "widgetlar uygulama arka planda açık dahi olsa güncellenmiyor ... 5dkdır").
// The app can't cover the gap either: its polling deliberately stops while
// backgrounded (focusManager in app/_layout.tsx), so nothing pushes updates.
extension HalkoraSnapshot {
  var isActive: Bool { state == "active" }
  var isLobby: Bool { state == "lobby" }

  /// Mirrors dayKeyFor() in src/lib/widget.ts — keep both in sync.
  func todayKey(at now: Date) -> String {
    return cycleStart(at: now)
  }

  /// Mirrors `rawDay` in src/data/challenges.ts — UNCLAMPED, so it keeps
  /// climbing past the last day. That overshoot is the only way the widget
  /// can tell "the final day, still open" from "this ring is over": the app
  /// drops finished halkalar from the sync, but it can only do that while
  /// it's running, and a ring that ends while the app is closed would
  /// otherwise keep offering a check-in forever.
  /// The opening date of the cycle `now` falls in, as "YYYY-MM-DD".
  ///
  /// A day runs deadline → deadline (Faz 1). Naming the cycle after the moment
  /// it OPENS is what makes the default "00:00" identical to a calendar day
  /// with no special case — a local time is never earlier than midnight.
  /// Mirrors public.challenge_cycle_start() in SQL, cycleStartFor() in the
  /// check-in function and cycleStart() in src/lib/cycle.ts.
  func cycleStart(at now: Date) -> String {
    let date = dateString(now, in: timezone)
    let deadline = String((deadlineTime ?? "00:00").prefix(5))
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: timezone) ?? .current
    f.dateFormat = "HH:mm"
    if f.string(from: now) >= deadline { return date }
    let u = DateFormatter()
    u.locale = Locale(identifier: "en_US_POSIX")
    u.timeZone = TimeZone(identifier: "UTC")
    u.dateFormat = "yyyy-MM-dd"
    guard let d = u.date(from: date) else { return date }
    return u.string(from: d.addingTimeInterval(-86_400))
  }

  func rawDay(at now: Date) -> Int {
    guard !startDate.isEmpty else { return 0 }
    let cycle = cycleStart(at: now)
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: "UTC")
    f.dateFormat = "yyyy-MM-dd"
    guard let start = f.date(from: startDate), let today = f.date(from: cycle)
    else { return 0 }
    let diff = (today.timeIntervalSince(start) / 86_400).rounded()
    return Int(diff) + 1
  }

  /// Mirrors daysSinceStart() + `currentDay` in src/data/challenges.ts.
  func currentDay(at now: Date) -> Int {
    let raw = rawDay(at: now)
    return raw <= 0 ? raw : min(raw, totalDays)
  }

  /// The calendar has moved past the last day — nothing left to check in for.
  func isOver(at now: Date) -> Bool { rawDay(at: now) > totalDays }

  func checkedInToday(at now: Date) -> Bool {
    !checkedInDayKey.isEmpty && checkedInDayKey == todayKey(at: now)
  }

  /// Drives the "Tamamlandı" frame: either the ring has run out of days, or
  /// it's the final day and that day is already covered. The first half used
  /// to be missing — with currentDay clamped, a finished ring looked exactly
  /// like an open final day and sat on "Check-in yap" indefinitely (saha
  /// testi bulgusu: "Gün 14/14 · Check-in yap").
  func isCompleted(at now: Date) -> Bool {
    guard isActive else { return false }
    if isOver(at: now) { return true }
    return currentDay(at: now) >= totalDays && checkedInToday(at: now)
  }

  /// Group counts only make sense for the day they were counted on.
  func groupCountsFresh(at now: Date) -> Bool { syncedDayKey == todayKey(at: now) }

  /// The roster as (initials, doneToday) pairs. Malformed or missing entries
  /// are skipped rather than rendered as blanks — an older build's snapshot
  /// simply has no roster, and the large widget hides that row.
  var rosterEntries: [(initials: String, done: Bool)] {
    guard let roster, !roster.isEmpty else { return [] }
    return roster.split(separator: ",").compactMap { field in
      let parts = field.split(separator: ":")
      guard parts.count == 2, !parts[0].isEmpty else { return nil }
      return (String(parts[0]), parts[1] == "1")
    }
  }

  /// Per-day ring state, with today's segment resolved for `now` rather than
  /// trusting whatever the app last stored.
  func ringSegments(at now: Date) -> [SegmentKind] {
    let chars = Array(segments)
    let day = currentDay(at: now)
    let over = isOver(at: now)
    return (1...max(totalDays, 1)).map { n in
      // Once the ring is over there is no "today" segment to breathe — the
      // last day falls back to whatever the app last recorded for it.
      if n == day && isActive && !over {
        return checkedInToday(at: now) ? .done : .today
      }
      guard n - 1 < chars.count else { return .waiting }
      switch chars[n - 1] {
      case "d": return .done
      case "j": return .joker
      default: return .waiting
      }
    }
  }

  /// Hours until this ring's cut-off, from `now` in its own timezone.
  /// Drives both the countdown and how warm the card reads (Faz 2 §2.4).
  func hoursToDeadline(at now: Date) -> Double {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: timezone) ?? .current
    f.dateFormat = "HH:mm"
    let parts = f.string(from: now).split(separator: ":")
    let nowMinutes = (Int(parts.first ?? "0") ?? 0) * 60 + (parts.count > 1 ? Int(parts[1]) ?? 0 : 0)
    let dl = String((deadlineTime ?? "00:00").prefix(5)).split(separator: ":")
    let dlMinutes = (Int(dl.first ?? "0") ?? 0) * 60 + (dl.count > 1 ? Int(dl[1]) ?? 0 : 0)
    // Past today's cut-off, the next one is a full cycle out.
    return Double(((dlMinutes - nowMinutes) + 1440) % 1440) / 60.0
  }

  /// Names still owed today, already capped at two by the app.
  var pendingList: [String] {
    guard let pendingNames, !pendingNames.isEmpty else { return [] }
    return pendingNames.split(separator: ",").map(String.init)
  }

  var isUserLast: Bool { (userIsLast ?? 0) != 0 }

  /// Consecutive covered days, counting back from the last settled day.
  ///
  /// Today is added only when it's actually covered — an open day does NOT
  /// break the streak, because the day isn't lost until it ends. Jokers
  /// count, matching how the rest of the app treats them.
  func streak(at now: Date) -> Int {
    let chars = Array(segments)
    var total = 0
    let over = isOver(at: now)
    if isActive && !over && checkedInToday(at: now) { total += 1 }
    var n = over ? totalDays : currentDay(at: now) - 1
    while n >= 1, n - 1 < chars.count {
      let ch = chars[n - 1]
      guard ch == "d" || ch == "j" else { break }
      total += 1
      n -= 1
    }
    return total
  }

  /// The ring for the streak widget: only the current run is lit.
  ///
  /// The progress ring was the wrong picture there — it drew how far the halka
  /// has come while the number in the middle said something else entirely, so
  /// the two disagreed on the same card. This lights exactly the days the
  /// streak is made of, ending at the most recent one.
  func streakSegments(at now: Date) -> [SegmentKind] {
    let run = streak(at: now)
    let last = isOver(at: now) ? totalDays : currentDay(at: now)
    let from = max(last - run + 1, 1)
    return (1...max(totalDays, 1)).map { n in
      run > 0 && n >= from && n <= last ? .done : .waiting
    }
  }

  /// The next `count` moments at which this snapshot's derived state changes
  /// on its own — one per day boundary. Pre-building an entry for each is
  /// what keeps the widget correct without spending reloads.
  func upcomingRollovers(after now: Date, count: Int) -> [Date] {
    let tz = TimeZone(identifier: timezone) ?? .current
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = tz
    // The day turns at the deadline now, not at midnight — scheduling entries
    // for midnight on a 21:00 ring would flip the counter three hours late.
    let parts = String((deadlineTime ?? "00:00").prefix(5)).split(separator: ":")
    let hour = Int(parts.first ?? "0") ?? 0
    let minute = parts.count > 1 ? (Int(parts[1]) ?? 0) : 0
    return (0...count).compactMap { offset -> Date? in
      guard let day = cal.date(byAdding: .day, value: offset, to: now),
        let at = cal.date(
          bySettingHour: hour, minute: minute, second: 0, of: cal.startOfDay(for: day))
      else { return nil }
      // A minute past the boundary, not exactly on it — rendering a hair
      // early would recompute the SAME cycle.
      let moment = at.addingTimeInterval(60)
      return moment > now ? moment : nil
    }.prefix(count).map { $0 }
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
  list[idx].checkedInDayKey = list[idx].todayKey(at: Date())
  // Keep the group counter honest about the check-in that just happened.
  if list[idx].groupCountsFresh(at: Date()) {
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

/// Moves the shared "which halka" cursor, or the "Bugün" page.
///
/// This replaces time-based rotation. Rotation was never dependable: WidgetKit
/// draws pre-built entries when it decides to, minute granularity is not
/// guaranteed, and on the Lock Screen it is sparser still — so the card
/// changed sometimes, which reads as a glitch rather than a feature. A button
/// moves the cursor when the person presses it, and nothing depends on the
/// system's timing.
struct CycleIntent: AppIntent {
  static var title: LocalizedStringResource = "Sonraki"

  /// Which cursor to move — `cursorHalka` (per-halka widgets share one, so
  /// they all show the same ring) or `cursorToday` (the Bugün page).
  @Parameter(title: "Kapsam")
  var scope: String

  @Parameter(title: "Yön")
  var delta: Int

  init() {}
  init(scope: String, delta: Int) {
    self.scope = scope
    self.delta = delta
  }

  func perform() async throws -> some IntentResult {
    setCursor(scope, cursor(scope) + delta)
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}

let cursorHalka = "halka"
let cursorToday = "today"

/// Cursors live in the App Group next to the snapshot. They're stored raw and
/// wrapped at read time against the CURRENT list length — the list changes
/// under them (a halka ends, another is created) and a stored index that was
/// valid yesterday would point past the end today.
private func cursor(_ scope: String) -> Int {
  UserDefaults(suiteName: appGroup)?.integer(forKey: "cursor.\(scope)") ?? 0
}

private func setCursor(_ scope: String, _ value: Int) {
  UserDefaults(suiteName: appGroup)?.set(value, forKey: "cursor.\(scope)")
}

/// Wraps `raw` into 0..<count, correctly for negative values too — Swift's %
/// keeps the sign of the dividend, so a "previous" tap at index 0 would
/// otherwise land on a negative index.
func wrapped(_ raw: Int, _ count: Int) -> Int {
  guard count > 0 else { return 0 }
  return ((raw % count) + count) % count
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

  /// Stored halkalar minus the ones whose last day is already behind us —
  /// a finished ring shouldn't take a rotation slot from a live one. If
  /// every ring is finished the full list is kept, so the widget shows a
  /// "Tamamlandı" frame instead of pretending there is nothing there.
  private func liveChallenges() -> [HalkoraSnapshot] {
    let stored = loadActiveChallenges()
    let now = Date()
    let live = stored.filter { !($0.isActive && $0.isOver(at: now)) }
    return live.isEmpty ? stored : live
  }

  func timeline(for configuration: SelectChallengeIntent, in context: Context) async -> Timeline<HalkoraEntry> {
    let all = liveChallenges()

    // Explicitly configured (Edit Widget -> picked one specific halka, meant
    // for stacking several copies) -> pin to just that one, no rotation.
    if let pickedId = configuration.challenge?.id,
      let picked = all.first(where: { $0.challengeId == pickedId })
    {
      return dayBoundaryTimeline(for: picked)
    }

    // Unconfigured + more than one halka -> auto-rotate. A Timeline can
    // carry several future-dated entries in one go; WidgetKit switches
    // between them locally as each date arrives, so only the one
    // timeline(for:) call counts against the refresh budget, not each
    // switch. Capped at 3 (matching the spec's "max 3 dots").
    // More than one halka: the shared cursor decides which, and the nav
    // control on the card moves it. No timer involved.
    if all.count > 1 {
      let shown = Array(all.prefix(3))
      let index = wrapped(cursor(cursorHalka), shown.count)
      return dayBoundaryTimeline(
        for: shown[index], rotationCount: shown.count, rotationIndex: index)
    }

    guard let single = all.first(where: { !$0.checkedInToday(at: Date()) }) ?? all.first else {
      // No halka at all — nothing to derive, so nothing to schedule; the
      // app's own reloadWidget() is the only thing that can change this.
      return Timeline(
        entries: [HalkoraEntry(date: .now, snapshot: nil, rotationCount: 1, rotationIndex: 0)],
        policy: .never)
    }
    return dayBoundaryTimeline(for: single)
  }

  /// One entry now plus one per upcoming day boundary, so the day counter
  /// and the "checked in today" state flip on schedule using entries
  /// WidgetKit already holds — no reload budget spent, which is the only
  /// thing that actually works here (see the note above the derivation).
  private func dayBoundaryTimeline(
    for snapshot: HalkoraSnapshot, rotationCount: Int = 1, rotationIndex: Int = 0
  ) -> Timeline<HalkoraEntry> {
    let now = Date()
    let dates = [now] + snapshot.upcomingRollovers(after: now, count: 4)
    let entries = dates.map {
      HalkoraEntry(
        date: $0, snapshot: snapshot,
        rotationCount: rotationCount, rotationIndex: rotationIndex)
    }
    return Timeline(entries: entries, policy: .atEnd)
  }

  private func resolve(_ configuration: SelectChallengeIntent) -> HalkoraSnapshot? {
    let all = liveChallenges()
    if let pickedId = configuration.challenge?.id,
      let picked = all.first(where: { $0.challengeId == pickedId })
    {
      return picked
    }
    guard all.count > 1 else { return all.first }
    let shown = Array(all.prefix(3))
    return shown[wrapped(cursor(cursorHalka), shown.count)]
  }
}

/// The idealized gallery frame (spec: "Preview sample data rules").
private let samplePreview = HalkoraSnapshot(
  challengeId: "", title: "Sabah 06:30 Kulübü", dailyAction: "06:30'da kalk",
  totalDays: 14, timezone: TimeZone.current.identifier,
  startDate: dateString(Date().addingTimeInterval(-6 * 86_400), in: TimeZone.current.identifier),
  checkedInDayKey: "",
  segments: "dddddd--------", syncedDayKey: "", participantsTotal: 8,
  participantsDoneToday: 4,
  roster: "EK:1,SA:1,MY:1,DT:1,BÖ:0,CN:0,AR:0,ZG:0",
  userIsLast: 0, pendingNames: "Ayşe,Mert",
  jokerRemaining: 1, state: "active", startsLabel: "",
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

/// Which halka of how many (spec 03). The spec asked for these to be
/// near-invisible, which held while rotation took a quarter of an hour and
/// read as a background detail. At a minute per halka the card visibly
/// changes under you, and an indicator you can't see makes that look like a
/// glitch rather than a rotation — so the active dot is ember and sized to
/// be legible at arm's length. Never more than three.
private struct RotationDots: View {
  let count: Int
  let index: Int
  /// Lock Screen accessories are drawn monochrome; ember would come out as
  /// plain white there, so those callers ask for the opacity treatment.
  var monochrome: Bool = false

  var body: some View {
    HStack(spacing: 4) {
      ForEach(0..<count, id: \.self) { i in
        Capsule()
          .fill(
            i == index
              ? (monochrome ? Color.white.opacity(0.9) : halkoraEmber)
              : Color.white.opacity(monochrome ? 0.3 : 0.18)
          )
          // The active one stretches instead of only brightening, so its
          // position is readable even in a glance too short to compare tones.
          .frame(width: i == index ? 12 : 5, height: 5)
      }
    }
  }
}

/// The nav control: previous, position, next. Deliberately UNFILLED — the
/// spec reserves the filled capsule for check-in, and a second solid button
/// would compete with the only one that matters.
private struct NavControl: View {
  let scope: String
  let count: Int
  let index: Int
  /// Shows "2/5" instead of dots once there are more positions than dots can
  /// carry legibly (the spec caps dots at three).
  var numeric: Bool = false

  var body: some View {
    HStack(spacing: 7) {
      Button(intent: CycleIntent(scope: scope, delta: -1)) {
        Image(systemName: "chevron.left")
          .font(.system(size: 9, weight: .bold))
          .foregroundStyle(halkoraTextSecondary)
          .frame(width: 14, height: 18)
      }
      .buttonStyle(.plain)

      if numeric {
        Text("\(index + 1)/\(count)")
          .font(wButton(10))
          .monospacedDigit()
          .foregroundStyle(halkoraTextTertiary)
      } else {
        HStack(spacing: 4) {
          ForEach(0..<count, id: \.self) { i in
            Capsule()
              .fill(i == index ? halkoraEmber : Color.white.opacity(0.18))
              .frame(width: i == index ? 10 : 4, height: 4)
          }
        }
      }

      Button(intent: CycleIntent(scope: scope, delta: 1)) {
        Image(systemName: "chevron.right")
          .font(.system(size: 9, weight: .bold))
          .foregroundStyle(halkoraTextSecondary)
          .frame(width: 14, height: 18)
      }
      .buttonStyle(.plain)
    }
    .padding(.horizontal, 7)
    .padding(.vertical, 3)
    .overlay(
      Capsule().stroke(Color.white.opacity(0.14), lineWidth: 0.5)
    )
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
    // Derive against the entry's own date, not Date(): WidgetKit builds
    // future-dated entries ahead of time, so reading the wall clock here
    // would bake "now" into a frame meant for tomorrow.
    let at = entry.date
    let card = VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .top) {
        ZStack {
          RingView(segments: s.ringSegments(at: at), lineWidth: 5, maxSegments: 16)
            .frame(width: 56, height: 56)
          if s.isActive {
            Text(c.dayShort(s.currentDay(at: at), s.totalDays))
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
        if s.isCompleted(at: at) {
          Pill(label: c.completedLabel, settled: true)
        } else if s.checkedInToday(at: at) {
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
    if s.isActive && !s.checkedInToday(at: at) && !s.isCompleted(at: at) {
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
    let at = entry.date
    HStack(alignment: .center, spacing: 16) {
      ZStack {
        RingView(segments: s.ringSegments(at: at), lineWidth: 7, maxSegments: 31)
          .frame(width: 88, height: 88)
        VStack(spacing: 0) {
          if s.isActive {
            Text(c.dayWord)
              .font(wMeta(9))
              .kerning(1.2)
              .foregroundStyle(halkoraTextTertiary)
            Text(c.dayShort(s.currentDay(at: at), s.totalDays))
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
            NavControl(
              scope: cursorHalka, count: entry.rotationCount, index: entry.rotationIndex)
          }
        }

        Spacer(minLength: 8)

        HStack(alignment: .bottom) {
          VStack(alignment: .leading, spacing: 2) {
            if s.isActive {
              if s.groupCountsFresh(at: at) {
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
            if s.isCompleted(at: at) {
              Pill(label: c.completedLabel, settled: true).fixedSize()
            } else if s.checkedInToday(at: at) {
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

// MARK: - Large (4×4)
//
// The size the spec left for a next pass. It earns the space by showing the
// group person by person instead of as a "4/8" count — at 2×2 and 4×2 there
// is no room for that, so the large widget answers a question the others
// can't: who is the ring still waiting on.

/// One person in the group grid. Ember-filled once they've covered today,
/// hollow while the ring is still waiting on them.
private struct RosterChip: View {
  let initials: String
  let done: Bool

  var body: some View {
    Text(initials)
      .font(wMeta(11))
      .foregroundStyle(done ? halkoraBg : halkoraTextSecondary)
      .frame(width: 30, height: 30)
      .background(
        Circle()
          .fill(done ? halkoraEmber : Color.clear)
          .overlay(
            Circle().stroke(done ? Color.clear : halkoraWaiting, lineWidth: 1.5)
          )
      )
  }
}

struct HalkoraLargeView: View {
  var entry: HalkoraEntry

  var body: some View {
    let c = copyFor(entry.snapshot?.locale)
    Group {
      if let s = entry.snapshot {
        content(s, c)
      } else {
        emptyState(c)
      }
    }
    .containerBackground(halkoraBg, for: .widget)
  }

  @ViewBuilder
  private func content(_ s: HalkoraSnapshot, _ c: WidgetCopy) -> some View {
    let at = entry.date
    let roster = s.rosterEntries
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 3) {
          Text(s.title)
            .font(wTitle(17))
            .kerning(-0.34)
            .foregroundStyle(halkoraTextPrimary)
            .lineLimit(2)
            .fixedSize(horizontal: false, vertical: true)
          if !s.dailyAction.isEmpty {
            Text(s.dailyAction)
              .font(wAction(13))
              .foregroundStyle(halkoraTextSecondary)
              .lineLimit(1)
          }
        }
        Spacer(minLength: 8)
        if entry.rotationCount > 1 {
          NavControl(
            scope: cursorHalka, count: entry.rotationCount, index: entry.rotationIndex)
        }
      }

      Spacer(minLength: 12)

      HStack(alignment: .center, spacing: 18) {
        ZStack {
          RingView(segments: s.ringSegments(at: at), lineWidth: 9, maxSegments: 31)
            .frame(width: 126, height: 126)
          VStack(spacing: 1) {
            if s.isActive {
              Text(c.dayWord)
                .font(wMeta(10))
                .kerning(1.4)
                .foregroundStyle(halkoraTextTertiary)
              Text(c.dayShort(s.currentDay(at: at), s.totalDays))
                .font(wCounter(24))
                .monospacedDigit()
                .foregroundStyle(halkoraTextPrimary)
            } else {
              Text(c.daysCount(s.totalDays))
                .font(wMeta(12))
                .foregroundStyle(halkoraTextSecondary)
            }
          }
        }

        VStack(alignment: .leading, spacing: 10) {
          if s.isActive {
            if s.groupCountsFresh(at: at) {
              Text(c.doneToday(s.participantsDoneToday, s.participantsTotal))
                .font(wMeta(12))
                .monospacedDigit()
                .foregroundStyle(halkoraTextSecondary)
            }
            if s.jokerRemaining > 0 {
              HStack(spacing: 5) {
                Circle().fill(halkoraJoker).frame(width: 6, height: 6)
                Text(c.jokerLeft(s.jokerRemaining))
                  .font(wMeta(12))
                  .monospacedDigit()
                  .foregroundStyle(halkoraTextSecondary)
              }
            }
            if s.isCompleted(at: at) {
              Pill(label: c.completedLabel, settled: true).fixedSize()
            } else if s.checkedInToday(at: at) {
              Pill(label: c.doneLabel, settled: true).fixedSize()
            } else {
              Button(intent: CheckInIntent(challengeId: s.challengeId)) {
                Pill(label: c.checkInCta).fixedSize().frame(minHeight: 44)
              }
              .buttonStyle(.plain)
            }
          } else {
            if !s.startsLabel.isEmpty {
              Text(s.startsLabel).font(wMeta(12)).foregroundStyle(halkoraTextSecondary)
            }
            Text(c.joinedCount(s.participantsTotal))
              .font(wMeta(12))
              .monospacedDigit()
              .foregroundStyle(halkoraTextTertiary)
          }
        }

        Spacer(minLength: 0)
      }

      Spacer(minLength: 12)

      // The group, person by person. Only when today's counts are still the
      // ones we synced — an out-of-date roster would mark people done for a
      // day that has already turned over, which is worse than showing none.
      //
      // A rule and a label above it: without them the grid floated at the
      // bottom edge with no relationship to anything, and the card read as
      // two unrelated cards stacked.
      if !roster.isEmpty && s.groupCountsFresh(at: at) {
        Rectangle()
          .fill(Color.white.opacity(0.07))
          .frame(height: 0.5)
          .padding(.bottom, 10)
        Text(c.todayTitle.uppercased())
          .font(wMeta(9))
          .kerning(1.4)
          .foregroundStyle(halkoraTextTertiary)
          .padding(.bottom, 8)
        // Wrapping by hand: WidgetKit has no Grid that flows on iOS 17, and a
        // fixed column count would clip a larger group.
        let rows = stride(from: 0, to: roster.count, by: 6).map {
          Array(roster[$0..<min($0 + 6, roster.count)])
        }
        VStack(alignment: .leading, spacing: 6) {
          ForEach(rows.indices, id: \.self) { r in
            HStack(spacing: 6) {
              ForEach(rows[r].indices, id: \.self) { i in
                RosterChip(initials: rows[r][i].initials, done: rows[r][i].done)
              }
              Spacer(minLength: 0)
            }
          }
        }
      }
    }
    .padding(18)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .widgetURL(URL(string: "halkora://challenge/\(s.challengeId)"))
  }

  private func emptyState(_ c: WidgetCopy) -> some View {
    VStack(spacing: 14) {
      ZStack {
        RingView(segments: Array(repeating: .waiting, count: 12), lineWidth: 9, maxSegments: 31)
          .frame(width: 126, height: 126)
        Image(systemName: "plus").font(.system(size: 28, weight: .semibold))
          .foregroundStyle(halkoraEmber)
      }
      Text(c.emptyTitle)
        .font(wTitle(17))
        .kerning(-0.34)
        .foregroundStyle(halkoraTextPrimary)
        .multilineTextAlignment(.center)
      Pill(label: c.emptyCta).fixedSize()
    }
    .padding(18)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .widgetURL(URL(string: "halkora://"))
  }
}

struct HalkoraLargeWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(
      kind: "HalkoraWidgetLarge", intent: SelectChallengeIntent.self, provider: HalkoraProvider()
    ) { entry in
      HalkoraLargeView(entry: entry)
    }
    .configurationDisplayName("Halka · grup")
    .description("Halkanın günü, joker durumu ve kimin bugünü kapattığı.")
    .supportedFamilies([.systemLarge])
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
    let at = entry.date
    if let s = entry.snapshot {
      ZStack {
        AccessoryWidgetBackground()
        RingView(segments: s.ringSegments(at: at), lineWidth: 4, maxSegments: 14, monochrome: true)
        // Day number while pending; a check once done. A finished ring reads
        // as done too — the fix for "Gün 14/14 · Check-in yap" reached the
        // home-screen views but not these, which never consulted isCompleted.
        if s.checkedInToday(at: at) || s.isCompleted(at: at) {
          Image(systemName: "checkmark").font(.system(size: 14, weight: .bold))
        } else if s.isActive {
          Text("\(s.currentDay(at: at))").font(.system(size: 15, weight: .semibold)).monospacedDigit()
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
    let at = entry.date
    if let s = entry.snapshot {
      let c = copyFor(s.locale)
      VStack(alignment: .leading, spacing: 3) {
        Text(s.title).font(.system(size: 13, weight: .semibold)).lineLimit(1)
        // The ring flattens to a tick bar — same segments, read left to right.
        TickBar(segments: s.ringSegments(at: at))
          .frame(height: 4)
        HStack(spacing: 4) {
          if s.isActive {
            Text(c.dayLong(s.currentDay(at: at), s.totalDays)).monospacedDigit()
            Text("·")
            if s.isCompleted(at: at) {
              doneLabelWithCheck(c.completedLabel)
            } else if s.checkedInToday(at: at) {
              doneLabelWithCheck(c.doneLabel)
            } else {
              Text(c.checkInCta)
            }
          } else {
            // A ring that hasn't started has no day to be on. The counter used
            // to run anyway and printed the negative distance to the start
            // date — "Gün -6/14" (saha testi bulgusu). Every other surface
            // already said "14 Ağustos'ta başlıyor"; these three didn't ask.
            Text(s.startsLabel.isEmpty ? c.daysCount(s.totalDays) : s.startsLabel)
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
    let at = entry.date
    if let s = entry.snapshot {
      let c = copyFor(s.locale)
      // One line, mini arc as the brand mark.
      Label {
        if !s.isActive {
          Text("\(c.brand) · \(s.startsLabel.isEmpty ? c.daysCount(s.totalDays) : s.startsLabel)")
        } else if s.isCompleted(at: at) {
          Text("\(c.brand) · \(c.completedLabel) ✓")
        } else if s.checkedInToday(at: at) {
          Text("\(c.brand) · \(c.doneLabel) ✓")
        } else {
          Text("\(c.brand) · \(c.dayLong(s.currentDay(at: at), s.totalDays))")
        }
      } icon: {
        Image(
          systemName: s.checkedInToday(at: at) || s.isCompleted(at: at)
            ? "circle.righthalf.filled" : "circle.dashed")
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

// MARK: - "Bugün" — every active halka at once
//
// Rotation answers "which halka" by taking turns; this answers it by showing
// them together. For anyone running more than one ring that is the shorter
// path to the thing the widget exists for — closing the day without opening
// the app — because nothing has to come around first.

struct HalkoraListEntry: TimelineEntry {
  let date: Date
  fileprivate let snapshots: [HalkoraSnapshot]
  /// Raw page cursor. Wrapped by the VIEW rather than here, because how many
  /// rows fit — and therefore how many pages exist — depends on the family,
  /// which the provider doesn't know.
  let cursor: Int
}

/// No AppIntent configuration: there is nothing to pick, the widget is the
/// whole list by definition.
struct HalkoraListProvider: TimelineProvider {
  func placeholder(in context: Context) -> HalkoraListEntry {
    HalkoraListEntry(date: .now, snapshots: [samplePreview], cursor: 0)
  }

  func getSnapshot(in context: Context, completion: @escaping (HalkoraListEntry) -> Void) {
    if context.isPreview {
      completion(HalkoraListEntry(date: .now, snapshots: [samplePreview], cursor: 0))
      return
    }
    completion(
      HalkoraListEntry(
        date: .now, snapshots: loadActiveChallenges(), cursor: cursor(cursorToday)))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<HalkoraListEntry>) -> Void) {
    let all = loadActiveChallenges()
    let now = Date()
    // Halkalar can sit in different timezones, so the boundaries that matter
    // are the union of theirs — merged, sorted, deduped. Same reasoning as
    // the single-halka timeline: pre-built entries cost no reload budget.
    var moments = Set<Date>()
    for s in all {
      for d in s.upcomingRollovers(after: now, count: 4) {
        moments.insert(d)
      }
    }
    let page = cursor(cursorToday)
    let dates = [now] + moments.sorted().prefix(24)
    let entries = dates.map { HalkoraListEntry(date: $0, snapshots: all, cursor: page) }
    completion(Timeline(entries: entries, policy: all.isEmpty ? .never : .atEnd))
  }
}

/// Covered today, or still owed. Filled ember vs a hollow waiting ring —
/// the same two states the big ring uses, at a size where they still read.
private struct StatusDot: View {
  let done: Bool

  var body: some View {
    Circle()
      .fill(done ? halkoraEmber : Color.clear)
      .frame(width: 10, height: 10)
      .overlay(Circle().stroke(done ? Color.clear : halkoraWaiting, lineWidth: 2))
      .frame(width: 22, height: 22)
  }
}

/// One halka as a row: where it stands, and the button that closes it.
private struct TodayRow: View {
  let snapshot: HalkoraSnapshot
  let at: Date
  let copy: WidgetCopy

  var body: some View {
    let s = snapshot
    HStack(spacing: 10) {
      // A ring at 30pt is unreadable — the segments turn to mush and it reads
      // as texture, not state. The day is already spelled out in the row, so
      // a single dot carries what's left: covered or still owed.
      StatusDot(done: s.checkedInToday(at: at) || s.isCompleted(at: at))

      VStack(alignment: .leading, spacing: 1) {
        Text(s.title)
          .font(wTitle(13))
          .kerning(-0.26)
          .foregroundStyle(halkoraTextPrimary)
          .lineLimit(1)
        if s.isActive {
          Text(copy.dayLong(s.currentDay(at: at), s.totalDays))
            .font(wMeta(10))
            .monospacedDigit()
            .foregroundStyle(halkoraTextTertiary)
        } else if !s.startsLabel.isEmpty {
          Text(s.startsLabel).font(wMeta(10)).foregroundStyle(halkoraTextTertiary)
        }
      }

      Spacer(minLength: 6)

      if s.isActive {
        if s.isCompleted(at: at) {
          Pill(label: copy.completedLabel, settled: true).fixedSize()
        } else if s.checkedInToday(at: at) {
          Pill(label: copy.doneLabel, settled: true).fixedSize()
        } else {
          Button(intent: CheckInIntent(challengeId: s.challengeId)) {
            Pill(label: copy.checkInCta).fixedSize().frame(minHeight: 40)
          }
          .buttonStyle(.plain)
        }
      }
    }
  }
}

struct HalkoraListView: View {
  @Environment(\.widgetFamily) var family
  var entry: HalkoraListEntry

  private var rowLimit: Int { family == .systemLarge ? 6 : 3 }

  var body: some View {
    let at = entry.date
    // Anything already over is dropped rather than listed as a dead row —
    // the app can't prune the stored list while it isn't running.
    let live = entry.snapshots.filter { !($0.isActive && $0.isOver(at: at)) }
    let c = copyFor(live.first?.locale ?? entry.snapshots.first?.locale)
    let openCount = live.filter { $0.isActive && !$0.checkedInToday(at: at) }.count
    let activeCount = live.filter { $0.isActive }.count
    // Anything past the first page used to simply not exist (saha testi
    // bulgusu: "3'ten fazla challenge varsa 4. hiç gözükmüyor").
    let pageCount = max(Int(ceil(Double(live.count) / Double(rowLimit))), 1)
    let page = wrapped(entry.cursor, pageCount)
    let start = page * rowLimit
    let shown = Array(live[min(start, live.count)..<min(start + rowLimit, live.count)])

    VStack(alignment: .leading, spacing: 0) {
      // .center, not a text baseline: the nav control isn't text and would
      // hang off a baseline meant for two labels.
      HStack(alignment: .center) {
        // "Bugün" only when something is actually running today. With every
        // ring still upcoming the rows read "Yarın başlıyor", and a "Bugün"
        // above them stamps a day onto rings that haven't got one.
        Text(activeCount > 0 ? c.todayTitle : c.soonTitle)
          .font(wTitle(15))
          .kerning(-0.3)
          .foregroundStyle(halkoraTextPrimary)
        if activeCount > 0 {
          Text(
            openCount == 0
              ? c.allClosed
              : c.ringsClosed(activeCount - openCount, activeCount)
          )
          .font(wMeta(10))
          .monospacedDigit()
          .foregroundStyle(openCount == 0 ? halkoraEmber : halkoraTextTertiary)
        }
        Spacer(minLength: 6)
        if pageCount > 1 {
          NavControl(scope: cursorToday, count: pageCount, index: page, numeric: true)
        }
      }
      .padding(.bottom, 10)

      if live.isEmpty {
        Spacer(minLength: 0)
        HStack {
          Spacer()
          VStack(spacing: 8) {
            Text(c.emptyTitle)
              .font(wTitle(13))
              .foregroundStyle(halkoraTextSecondary)
            Pill(label: c.emptyCta).fixedSize()
          }
          Spacer()
        }
        Spacer(minLength: 0)
      } else {
        // A ring that hasn't started belongs under its own heading. Listed
        // under "Bugün" it claims to be part of today, which it isn't — the
        // same stamp the header used to carry (saha testi bulgusu). Mirrors
        // Home's own BUGÜN / YAKINDA split so the widget and the app read the
        // same way.
        let todayRows = shown.filter { $0.isActive }
        let soonRows = shown.filter { !$0.isActive }
        VStack(alignment: .leading, spacing: 8) {
          ForEach(todayRows, id: \.challengeId) { s in
            TodayRow(snapshot: s, at: at, copy: c)
          }
          if !soonRows.isEmpty {
            // Only worth a heading when something above it is actually
            // today's; with nothing active the header already says "Yakında".
            if !todayRows.isEmpty {
              Text(c.soonTitle.uppercased())
                .font(wMeta(9))
                .kerning(1.4)
                .foregroundStyle(halkoraTextTertiary)
                .padding(.top, 4)
            }
            ForEach(soonRows, id: \.challengeId) { s in
              TodayRow(snapshot: s, at: at, copy: c)
            }
          }
        }
        Spacer(minLength: 0)
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .widgetURL(URL(string: "halkora://"))
    .containerBackground(halkoraBg, for: .widget)
  }
}

struct HalkoraListWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "HalkoraWidgetToday", provider: HalkoraListProvider()) { entry in
      HalkoraListView(entry: entry)
    }
    .configurationDisplayName("Bugün · tüm halkalar")
    .description("Aktif halkalarının hepsi tek kartta, her biri için check-in.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

// MARK: - "Seri" — the streak

struct HalkoraStreakView: View {
  var entry: HalkoraEntry

  var body: some View {
    let c = copyFor(entry.snapshot?.locale)
    Group {
      if let s = entry.snapshot {
        content(s, c)
      } else {
        VStack(spacing: 8) {
          Text(c.emptyTitle)
            .font(wTitle(13))
            .foregroundStyle(halkoraTextSecondary)
            .multilineTextAlignment(.center)
          Pill(label: c.emptyCta).fixedSize()
        }
        .padding(14)
        .widgetURL(URL(string: "halkora://"))
      }
    }
    .containerBackground(halkoraBg, for: .widget)
  }

  @ViewBuilder
  private func content(_ s: HalkoraSnapshot, _ c: WidgetCopy) -> some View {
    let at = entry.date
    let streak = s.streak(at: at)
    VStack(spacing: 0) {
      HStack {
        Text(c.streakWord)
          .font(wMeta(9))
          .kerning(1.4)
          .foregroundStyle(halkoraTextTertiary)
        Spacer(minLength: 4)
        if entry.rotationCount > 1 {
          NavControl(
            scope: cursorHalka, count: entry.rotationCount, index: entry.rotationIndex)
        }
      }

      Spacer(minLength: 6)

      ZStack {
        RingView(segments: s.streakSegments(at: at), lineWidth: 6, maxSegments: 16)
          .frame(width: 96, height: 96)
        Text("\(streak)")
          .font(wCounter(34))
          .monospacedDigit()
          .foregroundStyle(streak > 0 ? halkoraEmber : halkoraTextSecondary)
      }

      Spacer(minLength: 6)

      Text(s.title)
        .font(wMeta(11))
        .foregroundStyle(halkoraTextSecondary)
        .lineLimit(1)
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .widgetURL(URL(string: "halkora://challenge/\(s.challengeId)"))
  }
}

struct HalkoraStreakWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(
      kind: "HalkoraWidgetStreak", intent: SelectChallengeIntent.self, provider: HalkoraProvider()
    ) { entry in
      HalkoraStreakView(entry: entry)
    }
    .configurationDisplayName("Halka · seri")
    .description("Üst üste kaç gün kapattığın.")
    .supportedFamilies([.systemSmall])
  }
}

// MARK: - Lock Screen: "Bugün" summary and streak
//
// Same monochrome constraint as the per-halka accessories: the system strips
// color, so these lean on shape, weight and opacity.

/// Faz 2 §2.5 — the one thing worth saying right now, in priority order.
///
/// The queue itself is ordered by the app (src/lib/widgetUrgency.ts); this
/// only picks which SENTENCE the leading halka deserves. Splitting it that way
/// keeps the ranking rule — the part that will keep changing — out of a binary
/// that needs an Archive to update.
private struct SmartLine {
  let headline: String
  let detail: String?
  /// Warm once it's genuinely pressing, so the state reads before the words do.
  let urgent: Bool
}

private func smartLine(for live: [HalkoraSnapshot], at now: Date, _ c: WidgetCopy) -> SmartLine {
  let open = live.filter { !$0.checkedInToday(at: now) && !$0.isCompleted(at: now) }

  // 1. The ring is waiting on this person alone. Nothing outranks it.
  if let last = open.first(where: { $0.isUserLast }) {
    return SmartLine(headline: c.yourTurn, detail: last.title, urgent: true)
  }

  // 2. Everything closed.
  guard let next = open.first else {
    return SmartLine(headline: c.allClosed, detail: nil, urgent: false)
  }

  // 3. Close to the cut-off with more than one still open — the evening
  //    pressure case, expressed in hours rather than a fixed clock time so a
  //    ring closing at 10:00 gets the same treatment as one closing at 21:00.
  let hours = next.hoursToDeadline(at: now)
  if hours <= 3 && open.count > 1 {
    return SmartLine(
      headline: c.streakAtRisk(open.count), detail: c.hoursLeft(Int(hours.rounded(.up))),
      urgent: true)
  }

  // 4. Otherwise name who the leading ring is still owed by.
  let pending = next.pendingList
  let more = max(next.participantsTotal - next.participantsDoneToday - pending.count, 0)
  let detail =
    pending.isEmpty
    ? c.hoursLeft(Int(hours.rounded(.up)))
    : (more > 0
      ? c.waitingOnMore(pending.joined(separator: ", "), more)
      : c.waitingOn(pending.joined(separator: ", ")))
  return SmartLine(headline: next.title, detail: detail, urgent: hours <= 3)
}

struct HalkoraLockTodayView: View {
  @Environment(\.widgetFamily) var family
  var entry: HalkoraListEntry

  var body: some View {
    let at = entry.date
    let live = entry.snapshots.filter { $0.isActive && !$0.isOver(at: at) }
    let c = copyFor(live.first?.locale ?? entry.snapshots.first?.locale)
    let total = live.count
    let done = live.filter { $0.checkedInToday(at: at) }.count

    switch family {
    case .accessoryInline:
      Text(
        total == 0
          ? c.noneActive
          : "\(c.brand) · \(smartLine(for: live, at: at, c).headline)")
    case .accessoryRectangular:
      // Smart Mode: one prioritised sentence rather than a summary. On the
      // Lock Screen there's room for exactly one thing, so it should be the
      // thing that most deserves the glance.
      VStack(alignment: .leading, spacing: 2) {
        if total == 0 {
          Text(c.todayTitle).font(.system(size: 13, weight: .semibold))
          Text(c.noneActive).font(.system(size: 12)).opacity(0.75)
        } else {
          let line = smartLine(for: live, at: at, c)
          Text(line.headline)
            .font(.system(size: 13, weight: .semibold))
            .lineLimit(1)
          if let detail = line.detail {
            Text(detail).font(.system(size: 12)).opacity(0.75).lineLimit(1)
          }
          // One tick per halka — the day at a glance, under the sentence.
          HStack(spacing: 3) {
            ForEach(live.indices, id: \.self) { i in
              Capsule()
                .fill(Color.white.opacity(live[i].checkedInToday(at: at) ? 1 : 0.28))
                .frame(height: 3)
            }
          }
          .padding(.top, 2)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    default:
      // Circular: rings closed today, as a gauge.
      ZStack {
        RingView(
          segments: (0..<max(total, 1)).map { i in
            total == 0 ? .waiting : (live[i].checkedInToday(at: at) ? .done : .waiting)
          },
          lineWidth: 5, maxSegments: 14, monochrome: true
        )
        Text(total == 0 ? "—" : "\(done)")
          .font(.system(size: 17, weight: .semibold, design: .rounded))
          .monospacedDigit()
      }
    }
  }
}

struct HalkoraLockTodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "HalkoraWidgetLockToday", provider: HalkoraListProvider()) { entry in
      HalkoraLockTodayView(entry: entry)
    }
    .configurationDisplayName("Bugün · özet")
    .description("Bugün kaç halkanı kapattığın.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

struct HalkoraLockStreakView: View {
  @Environment(\.widgetFamily) var family
  var entry: HalkoraEntry

  var body: some View {
    let c = copyFor(entry.snapshot?.locale)
    let at = entry.date
    let streak = entry.snapshot?.streak(at: at) ?? 0

    switch family {
    case .accessoryInline:
      Text("\(c.brand) · \(c.streakUnit(streak))")
    default:
      ZStack {
        if let s = entry.snapshot {
          RingView(
            segments: s.streakSegments(at: at), lineWidth: 5, maxSegments: 14, monochrome: true)
        }
        VStack(spacing: -2) {
          Text("\(streak)")
            .font(.system(size: 18, weight: .semibold, design: .rounded))
            .monospacedDigit()
          Text(c.streakWord)
            .font(.system(size: 7, weight: .medium))
            .kerning(0.6)
            .opacity(0.7)
        }
      }
    }
  }
}

struct HalkoraLockStreakWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(
      kind: "HalkoraWidgetLockStreak", intent: SelectChallengeIntent.self,
      provider: HalkoraProvider()
    ) { entry in
      HalkoraLockStreakView(entry: entry)
    }
    .configurationDisplayName("Halka · seri (kilit ekranı)")
    .description("Üst üste kaç gün kapattığın.")
    .supportedFamilies([.accessoryCircular, .accessoryInline])
  }
}

// MARK: - Bundle

@main
struct HalkoraWidgetBundle: WidgetBundle {
  var body: some Widget {
    HalkoraSmallWidget()
    HalkoraMediumWidget()
    HalkoraLargeWidget()
    HalkoraListWidget()
    HalkoraStreakWidget()
    HalkoraLockWidget()
    HalkoraLockTodayWidget()
    HalkoraLockStreakWidget()
  }
}
