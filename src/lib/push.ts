import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// The challenge Detail screen currently on screen, set by
// app/challenge/[id]/index.tsx on focus/blur — module-level rather than
// store/context state because this needs to be readable from
// setNotificationHandler's callback below, which runs outside React
// entirely. A push for the SAME challenge the user is already looking at is
// redundant (saha testi bulgusu: "challenge içindeyken o challange ile
// ilgili bildirim üstte gözükmesin, saçma çünkü zaten bakıyorum") — every
// other challenge's push still shows normally.
let activeChallengeId: string | null = null;
export function setActiveChallengeId(id: string | null): void {
  activeChallengeId = id;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const challengeId = notification.request.content.data?.challengeId as string | undefined;
    const suppress = !!challengeId && challengeId === activeChallengeId;
    return {
      shouldShowAlert: !suppress,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: !suppress,
      shouldShowList: !suppress,
    };
  },
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Halkora',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B47',
  });
}

/**
 * Requests notification permission and returns an Expo push token, or null when
 * denied/unavailable (simulator, `eas init` never run so there's no project id,
 * permission refused, etc). Push is a nice-to-have, never a blocker — this
 * intentionally never throws.
 */
export interface PushRegistration {
  token: string;
  /** 'development' | 'production' | null — see apnsEnvironment(). */
  environment: string | null;
}

export async function registerForPushToken(): Promise<PushRegistration | null> {
  if (Platform.OS === 'web') return null; // native-only feature; expo-notifications' web shim is partial
  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token, environment: await apnsEnvironment() };
  } catch {
    return null;
  }
}

/**
 * Which APNs service this build's token belongs to: 'development' (sandbox)
 * or 'production'.
 *
 * expo-notifications asks expo-application this same question to decide which
 * service to register the token against, and falls back to production if the
 * answer doesn't come — silently. That fallback is exactly how a sandbox
 * token ends up registered for production, which APNs answers with
 * BadEnvironmentKeyInToken and nothing on this side ever sees. Recording the
 * answer next to the token makes a wrong one visible in one query instead of
 * being a mystery that costs a day.
 */
async function apnsEnvironment(): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    return await Application.getIosPushNotificationServiceEnvironmentAsync();
  } catch {
    return null;
  }
}
