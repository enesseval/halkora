import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { RECEIVED_INVITES_KEY } from '@/components/InvitesSheet';
import { colors } from '@/theme/tokens';
import { useAuth, useAuthInit, useSyncPushToken, useSyncLocale } from '@/hooks/useAuth';
import { stashPendingInviteCode, takePendingInviteCode } from '@/lib/pendingInvite';
import { initLocale, useT } from '@/i18n';
import { ErrorState } from '@/components/ErrorState';
import { BootSplash } from '@/components/BootSplash';

SplashScreen.preventAutoHideAsync().catch(() => {});

// react-query's polling (refetchInterval) only pauses itself when it thinks
// the app isn't "focused" — on web that's tab visibility, but on native
// nothing reports that by default, so the Home/Detail/chat polls kept
// hitting Supabase every few seconds even with the app fully backgrounded.
// Wiring AppState in makes refetchIntervalInBackground's default (false)
// actually take effect on iOS/Android.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    focusManager.setFocused(state === 'active');
  });
}

/**
 * Auth-aware routing:
 *  - signed out            -> (auth)/welcome
 *  - signed in, no name    -> (auth)/onboarding
 *  - signed in, has name   -> (main) home
 * Only enforced when Supabase is configured; otherwise the app stays on the
 * Phase-1 mock layer so nothing breaks mid-migration.
 */
function useProtectedRoute(navigatorMounted: boolean) {
  const { ready, configured, isSignedIn, needsOnboarding } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Nothing to navigate until the Stack is on screen — see RootNavigator.
    if (!navigatorMounted) return;
    if (!ready || !configured) return;
    const inAuthGroup = segments[0] === '(auth)';
    const atOnboarding = segments.some((s) => s === 'onboarding');
    // A deep link to /join/{code} (or the short public /j/{code} form) hit
    // while signed out or mid-onboarding is about to get redirected away —
    // stash the code so it isn't lost (see src/lib/pendingInvite.ts;
    // consumed at the end of onboarding).
    const joinMatch = pathname.match(/^\/(?:join|j)\/(.+)$/);

    if (!isSignedIn) {
      if (!inAuthGroup) {
        if (joinMatch) stashPendingInviteCode(joinMatch[1]);
        router.replace('/welcome');
      }
    } else if (needsOnboarding) {
      if (!atOnboarding) {
        if (joinMatch) stashPendingInviteCode(joinMatch[1]);
        router.replace('/onboarding');
      }
    } else {
      // Signed in + has a name. Leave the O5 "start" fork reachable, but never
      // strand the user on the welcome/name gates.
      const onGate = segments.some((s) => s === 'welcome' || s === 'onboarding');
      if (onGate) {
        // Someone who re-authenticates from Welcome (e.g. reinstalled and
        // signed back into an Apple account that already has a name) skips
        // onboarding entirely — onboarding.tsx's own pending-code consumption
        // never runs for them, so it has to happen here too, or their
        // /join/{code} deep link (stashed before this redirect) is lost.
        takePendingInviteCode().then((pendingCode) => {
          router.replace(pendingCode ? `/join/${pendingCode}` : '/');
        });
      }
    }
  }, [navigatorMounted, ready, configured, isSignedIn, needsOnboarding, segments, pathname, router]);
}

/**
 * Tapping a push notification (cold-start or from the background) routes
 * straight to the challenge it's about — `data.challengeId` is set by the
 * `notify` Edge Function (docs/PHASE2-SUPABASE.md "Ek I").
 */
function useNotificationDeepLink(navigatorMounted: boolean) {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    // Native-only: expo-notifications' web shim doesn't implement
    // getLastNotificationResponseAsync and throws if called.
    //
    // Gated on the navigator being mounted, not merely on auth being ready.
    // A tapped notification resolves as soon as the session does, which is
    // well before the boot screen's own minimum beat is over — and while that
    // beat runs, RootNavigator renders BootSplash INSTEAD of the Stack. So
    // this used to push a route at a navigator that did not exist yet.
    if (!navigatorMounted || Platform.OS === 'web') return;

    const go = (data: unknown) => {
      const d = data as { challengeId?: string; inviteCode?: string } | undefined;
      // dismissTo, not push. Every tap used to stack another screen: three
      // notifications meant three ring screens to back out of one at a time,
      // and tapping a notification for the ring you were already looking at
      // put a second copy of it on top of the first (saha testi bulgusu —
      // "3 kere girersem tek tek 3 ayrı halka detayını gördükten sonra ana
      // ekrana erişebiliyorum").
      //
      // dismissTo pops back to that route if it is already in the stack and
      // swaps its params, and pushes only when it isn't there. So the stack
      // stays Home + one ring, however many notifications get tapped, and
      // one back press always reaches Home. Same call the join flow already
      // uses for the same reason (app/join/[code].tsx).
      if (d?.inviteCode) {
        router.dismissTo(`/join/${d.inviteCode}`);
      } else if (d?.challengeId) {
        router.dismissTo(`/challenge/${d.challengeId}`);
      }
    };

    if (!handled.current) {
      handled.current = true;
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) go(response.notification.request.content.data);
      });
    }

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      go(response.notification.request.content.data);
    });

    // An invite that ARRIVES while the app is open should light the bell then
    // and there, without waiting for the next poll and without depending on
    // the invites table having been added to the realtime publication. The
    // push already reached this device, so it is the most reliable signal
    // available (saha testi bulgusu — "bildirim geliyor ama zil aktif
    // olmuyor").
    const received = Notifications.addNotificationReceivedListener((n) => {
      const d = n.request.content.data as { inviteCode?: string } | undefined;
      if (d?.inviteCode) queryClient.invalidateQueries({ queryKey: RECEIVED_INVITES_KEY });
    });

    return () => {
      sub.remove();
      received.remove();
    };
  }, [navigatorMounted, router]);
}

/** Reads the persisted language choice (or detects the device's) once, before
 * anything renders real copy — see src/i18n/index.ts. */
function useLocaleInit(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    initLocale().then(() => setReady(true));
  }, []);
  return ready;
}

/**
 * Keeps the boot screen (BootSplash) up for at least `ms`, regardless of how
 * fast auth/locale actually resolve — a deliberate branding beat instead of
 * a random flash that's there on a slow network and gone instantly on a warm
 * cache.
 */
function useMinBootDelay(ms: number): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return done;
}

/**
 * Shown instead of the whole app when EXPO_PUBLIC_SUPABASE_* env vars weren't
 * present at build time (`isSupabaseConfigured` false) — a build/config bug,
 * never something a user or retry can fix. This used to silently fall back to
 * running on the old Phase-1 mock layer instead, which looked like a working
 * app (fake data, no real auth) and hid the real problem; a loud, unmistakable
 * error is safer now that Supabase is the only real backend.
 */
function ConfigErrorScreen() {
  const { t } = useT();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <ErrorState message={t.errors.appUnavailable} detail={t.errors.appUnavailableDetail} />
    </View>
  );
}

function RootNavigator() {
  const { ready, configured } = useAuth();
  const localeReady = useLocaleInit();
  // 2600ms == one full lap of BootSplash's chase animation (8 segments at
  // 260ms + a 2-step pause) — the old 1400ms cut it off mid-loop, so the
  // ring never actually finished a visible cycle (saha testi bulgusu).
  const bootDelayDone = useMinBootDelay(2600);
  useAuthInit();

  /**
   * Whether the <Stack> below is actually on screen.
   *
   * The two branches under this render BootSplash and ConfigErrorScreen
   * INSTEAD of the Stack, so for as long as either holds there is no
   * navigator for router.push/replace to act on. Both hooks that navigate
   * wait for this rather than for their own readiness, which they used to —
   * and a notification tap is the one path where those two moments are far
   * enough apart to matter, because it navigates the instant the session
   * resolves while the boot screen still has seconds of its beat to run.
   */
  const navigatorMounted = localeReady && bootDelayDone && configured && ready;

  useProtectedRoute(navigatorMounted);
  useSyncPushToken();
  useSyncLocale();
  useNotificationDeepLink(navigatorMounted);

  // Avoid a flash of Home before the persisted session is restored, or of
  // default-locale copy before the saved/detected language is applied — and
  // hold the boot screen open for its own minimum beat on top of that.
  if (!localeReady || (configured && !ready) || !bootDelayDone) {
    return <BootSplash />;
  }

  if (!configured) {
    return <ConfigErrorScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bgBase },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(main)/index" />
      <Stack.Screen name="(auth)/welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="(auth)/onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="(auth)/start" options={{ animation: 'fade' }} />
      <Stack.Screen
        name="(main)/create"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="(main)/settings" />
      <Stack.Screen name="challenge/[id]/index" />
      <Stack.Screen name="challenge/[id]/invite" />
      <Stack.Screen name="challenge/[id]/complete" />
      <Stack.Screen
        name="challenge/[id]/share"
        options={{ presentation: 'transparentModal', animation: 'none' }}
      />
      <Stack.Screen name="join/[code]" options={{ animation: 'fade' }} />
      <Stack.Screen name="j/[code]" options={{ animation: 'none' }} />
      <Stack.Screen
        name="paywall"
        options={{ presentation: 'transparentModal', animation: 'none' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'GeneralSans-Semibold': require('../assets/fonts/GeneralSans-Semibold.ttf'),
    'GeneralSans-Bold': require('../assets/fonts/GeneralSans-Bold.ttf'),
    'GeneralSans-Medium': require('../assets/fonts/GeneralSans-Medium.ttf'),
    'Satoshi-Regular': require('../assets/fonts/Satoshi-Regular.ttf'),
    'Satoshi-Medium': require('../assets/fonts/Satoshi-Medium.ttf'),
    'Satoshi-Bold': require('../assets/fonts/Satoshi-Bold.ttf'),
  });

  /**
   * A bound on the font gate.
   *
   * Below this, `return null` means the native splash stays up — and that
   * splash carries no image and no name, so a stall there is a plain dark
   * rectangle with nothing happening on it. That is what a notification
   * cold-start was reported as landing on. Whatever holds it up, sitting
   * there forever is never the right answer: after this long the app renders
   * with whatever fonts iOS has, which is a worse-looking app rather than no
   * app at all.
   */
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontsTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  const canRender = loaded || !!error || fontsTimedOut;

  useEffect(() => {
    if (canRender) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [canRender]);

  if (!canRender) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgBase }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
