import * as Notifications from 'expo-notifications';
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
export async function registerForPushToken(): Promise<string | null> {
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
    return token;
  } catch {
    return null;
  }
}
