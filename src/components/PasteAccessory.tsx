import { useCallback, useState } from 'react';
import { InputAccessoryView, Platform, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, hairline } from '@/theme/tokens';

/**
 * One-tap paste for the invite code, docked directly above the keyboard.
 *
 * The behaviour originally asked for — iOS's own QuickType chip offering the
 * clipboard — is not something an app can turn on. It belongs to the system,
 * it appears at iOS's discretion, and no combination of TextInput props
 * summons it; setting a specific textContentType actively replaces the
 * QuickType bar with that kind of autofill instead (which is why both
 * "oneTimeCode" and "URL" made things worse rather than better).
 *
 * The one route that pastes in a single tap with NO "Allow Paste?" prompt is
 * Apple's UIPasteControl — the tap on the control IS the consent. Reading the
 * pasteboard in code (Clipboard.getStringAsync) always raises that prompt on
 * iOS 16+, and that prompt is exactly the friction being reported.
 *
 * So the control is Apple's, and InputAccessoryView docks it where the
 * suggestion was expected: attached to the top of the keyboard, not floating
 * in the middle of the app's own UI.
 *
 * Privacy (and the reason there's no content-based filtering here): the
 * clipboard is never read to decide whether to show this. `hasStringAsync`
 * only answers "is there text at all" and reads nothing, and it runs once per
 * focus — no polling, no read on launch, no logging, nothing sent anywhere.
 * Validating that the clipboard really holds an invite code would require
 * reading it, which would raise the very prompt this exists to avoid; the
 * pasted text goes through the same extractCode/validation path as typing
 * instead, so a wrong paste is reported the same way a typo is.
 */
export const PASTE_ACCESSORY_ID = 'halkora-invite-paste';

export function usePasteAccessory() {
  const [available, setAvailable] = useState(false);

  // Call from the field's onFocus — the only moment we ask anything about the
  // clipboard.
  const check = useCallback(() => {
    if (Platform.OS !== 'ios' || !Clipboard.isPasteButtonAvailable) return;
    Clipboard.hasStringAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);

  return { available, check };
}

/**
 * Renders nothing unless there is something to paste, so the normal QuickType
 * bar is left alone the rest of the time. iOS only: InputAccessoryView is a
 * no-op elsewhere, and Android's own paste handling is untouched.
 */
export function PasteAccessory({
  visible,
  onPaste,
}: {
  visible: boolean;
  onPaste: (text: string) => void;
}) {
  if (Platform.OS !== 'ios' || !visible || !Clipboard.isPasteButtonAvailable) return null;

  return (
    <InputAccessoryView nativeID={PASTE_ACCESSORY_ID}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: colors.bgElevated,
          borderTopWidth: hairline,
          borderTopColor: colors.strokeSubtle,
        }}
      >
        <Clipboard.ClipboardPasteButton
          // Apple draws and localizes this control itself; the label and icon
          // aren't ours to change, which is the point — it reads as a system
          // affordance rather than a button the app invented.
          displayMode="iconAndLabel"
          cornerStyle="capsule"
          backgroundColor={colors.ember}
          foregroundColor={colors.bgBase}
          // Text only: an image on the clipboard has no business here, and
          // accepting it would light the control up for content we can't use.
          acceptedContentTypes={['plain-text']}
          onPress={(data) => {
            if (data.type === 'text') onPaste(data.text);
          }}
          // Without explicit width/height the control doesn't render at all.
          style={{ width: 128, height: 36 }}
        />
      </View>
    </InputAccessoryView>
  );
}
