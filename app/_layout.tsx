import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { colors } from '@/theme/tokens';
import { useAuth, useAuthInit } from '@/hooks/useAuth';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

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
  const router = useRouter();

  useEffect(() => {
    if (!ready || !configured) return;
    const inAuthGroup = segments[0] === '(auth)';
    const atOnboarding = segments.some((s) => s === 'onboarding');

    if (!isSignedIn) {
      if (!inAuthGroup) router.replace('/welcome');
    } else if (needsOnboarding) {
      if (!atOnboarding) router.replace('/onboarding');
    } else {
      // Signed in + has a name. Leave the O5 "start" fork reachable, but never
      // strand the user on the welcome/name gates.
      const onGate = segments.some((s) => s === 'welcome' || s === 'onboarding');
      if (onGate) router.replace('/');
    }
  }, [ready, configured, isSignedIn, needsOnboarding, segments, router]);
}

function RootNavigator() {
  const { ready, configured } = useAuth();
  useAuthInit();
  useProtectedRoute();

  // Avoid a flash of Home before the persisted session is restored.
  if (configured && !ready) {
    return <View style={{ flex: 1, backgroundColor: colors.bgBase }} />;
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
