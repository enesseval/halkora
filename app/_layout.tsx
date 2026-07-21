import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { colors } from '@/theme/tokens';
import { useAuth, useAuthInit, useSyncPushToken, useSyncLocale } from '@/hooks/useAuth';
import { stashPendingInviteCode, takePendingInviteCode } from '@/lib/pendingInvite';
import { initLocale, useT } from '@/i18n';
import { ErrorState } from '@/components/ErrorState';
import { BootSplash } from '@/components/BootSplash';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

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
function useProtectedRoute() {
  const { ready, configured, isSignedIn, needsOnboarding } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
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
  }, [ready, configured, isSignedIn, needsOnboarding, segments, pathname, router]);
}

/**
 * Tapping a push notification (cold-start or from the background) routes
 * straight to the challenge it's about — `data.challengeId` is set by the
 * `notify` Edge Function (docs/PHASE2-SUPABASE.md "Ek I").
 */
function useNotificationDeepLink(ready: boolean) {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    // Native-only: expo-notifications' web shim doesn't implement
    // getLastNotificationResponseAsync and throws if called.
    if (!ready || Platform.OS === 'web') return;

    const go = (data: unknown) => {
      const d = data as { challengeId?: string; inviteCode?: string } | undefined;
      // An invite recipient isn't a participant yet — RLS blocks
      // /challenge/{id}, so this routes to the public join-preview screen
      // instead (docs/PHASE2-SUPABASE.md "Ek O" follow-up).
      if (d?.inviteCode) {
        router.push(`/join/${d.inviteCode}`);
      } else if (d?.challengeId) {
        router.push(`/challenge/${d.challengeId}`);
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
    return () => sub.remove();
  }, [ready, router]);
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
  useProtectedRoute();
  useSyncPushToken();
  useSyncLocale();
  useNotificationDeepLink(ready);

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

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

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
