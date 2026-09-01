import { useRef, useState } from 'react';
import { Alert, Modal, Pressable, Share, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors, fonts, hairline, radius, spacing } from '@/theme/tokens';
import { useLayout } from '@/theme/layout';
import { AppText, Button } from './ui';
import { InviteCard, STORY_H, STORY_W, SQUARE, type InviteCardFormat } from './InviteCard';
import { inviteUrl } from '@/lib/invite';
import { useT } from '@/i18n';
import type { Challenge } from '@/data/types';

/** How wide the preview is allowed to be inside the sheet. */
const PREVIEW_W = 156;

/** The two outlined buttons under the primary one. */
function SecondaryAction({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        height: 46,
        borderRadius: radius.pill,
        borderWidth: hairline,
        borderColor: colors.strokeSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed || disabled ? 0.6 : 1,
      })}
    >
      <AppText variant="bodyMedium" style={{ fontSize: 14 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * "Halkanı paylaş" — the sheet that turns a ring into a postable image.
 *
 * The card is rendered off-screen at full size and captured, rather than
 * captured from the scaled preview: a screenshot of a 150pt preview would be
 * a 450px image, far below what a Story needs. The visible preview is the
 * same component under a transform, so what you see is what gets posted.
 */
export function ShareRingSheet({
  challenge,
  onClose,
}: {
  challenge: Challenge;
  onClose: () => void;
}) {
  const { t } = useT();
  const { sideGutter } = useLayout();
  const [format, setFormat] = useState<InviteCardFormat>('story');
  const [busy, setBusy] = useState(false);
  const shotRef = useRef<View>(null);

  const link = inviteUrl(challenge.inviteCode);
  const scale = PREVIEW_W / (format === 'story' ? STORY_W : SQUARE);

  const capture = async (): Promise<string> =>
    captureRef(shotRef, {
      format: 'png',
      quality: 1,
      // The card is laid out at 360pt wide; capturing at the device's pixel
      // ratio is what makes a 3x phone produce the 1080px the design targets.
      result: 'tmpfile',
    });

  /**
   * Image and link together.
   *
   * It used to send the image through expo-sharing and drop the link on the
   * clipboard, which left the recipient with a picture and nothing to tap —
   * the card even had to explain that the link was "beside this story". React
   * Native's own Share takes both a `url` and a `message`, so Messages and
   * WhatsApp get the picture with the invite under it, in one go. Instagram
   * and X ignore the text, which is the right trade: they were never going to
   * carry a tappable link anyway.
   *
   * The sheet closes BEFORE the system sheet opens. iOS presents the activity
   * controller from the root view controller, which sits behind this Modal, so
   * dismissing it by tapping outside left the app with a presentation it
   * thought was still up and nothing on screen responding.
   */
  const doShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBusy(true);
    let uri: string;
    try {
      uri = await capture();
    } catch {
      setBusy(false);
      return;
    }
    setBusy(false);
    onClose();
    // A frame for the Modal to actually come down before the system sheet
    // takes over — presenting into a window still being dismissed is the
    // other half of the same freeze.
    setTimeout(() => {
      Share.share({ message: t.invite.shareMessage(challenge.title, link), url: uri }).catch(() => {
        // Cancelling is a normal thing to do, not an error.
      });
    }, 250);
  };

  /**
   * Saving to the camera roll needs a permission this app asks for nowhere
   * else, so the system sheet stands in for it — it offers "Save Image"
   * using a permission iOS already manages.
   *
   * It goes through React Native's Share rather than expo-sharing, which is
   * what "Save Image" was missing from: expo-sharing hands the file to a
   * document-interaction sheet, whose job is opening the file in another app,
   * so it lists apps and no system actions at all. Share presents the real
   * activity controller, and a lone image file URL is what makes iOS offer to
   * save it.
   */
  const doSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBusy(true);
    let uri: string;
    try {
      uri = await capture();
    } catch {
      setBusy(false);
      Alert.alert(t.shareCard.savedFailed);
      return;
    }
    setBusy(false);
    onClose();
    setTimeout(() => {
      // No message: a share sheet holding only an image is the one that
      // offers to save it. Adding text turns it into a "send this" sheet.
      Share.share({ url: uri }).catch(() => {});
    }, 250);
  };

  /**
   * The plain text-and-link share, kept alongside the image rather than
   * replaced by it. An image is what Instagram and X want; Messages and
   * WhatsApp want a link they can unfurl into a preview card, and forcing the
   * image path there meant the link arrived as a separate paste or not at all.
   */
  const doShareLink = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await Share.share({ message: t.invite.shareMessage(challenge.title, link) });
    } catch {
      // Cancelling lands here too — nothing to report.
    }
  };

  const doCopy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await Clipboard.setStringAsync(link);
    Alert.alert(t.shareCard.copied, link);
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1, backgroundColor: colors.scrim }}>
        <View style={[{ flex: 1, justifyContent: 'flex-end' }, sideGutter > 0 ? { paddingHorizontal: sideGutter } : null]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />

          <Animated.View
            entering={SlideInDown.duration(260)}
            style={{
              backgroundColor: colors.bgSurface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              borderWidth: hairline,
              borderColor: colors.strokeSubtle,
              paddingHorizontal: spacing.screenX,
              paddingTop: 12,
              paddingBottom: 36,
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.strokeSubtle,
                marginBottom: 20,
              }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="screenTitle" style={{ fontSize: 22 }}>
                {t.shareCard.sheetTitle}
              </AppText>
              {/* Story is primary, but someone inviting over X genuinely needs
                  the square — dropping to one format loses a surface. */}
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: colors.bgElevated,
                  borderRadius: radius.pill,
                  padding: 3,
                }}
              >
                {(['story', 'square'] as const).map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setFormat(f);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: radius.pill,
                      backgroundColor: format === f ? colors.ember : 'transparent',
                    }}
                  >
                    <AppText
                      style={{
                        fontFamily: fonts.bodyMedium,
                        fontSize: 13,
                        color: format === f ? colors.bgBase : colors.textSecondary,
                      }}
                    >
                      {f === 'story' ? t.shareCard.formatStory : t.shareCard.formatSquare}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Preview: the real card, scaled down.
                A scale transform does NOT change layout size — the card still
                occupies its full 360×640 and, scaled about its own centre,
                spilled over the buttons below it. So the wrapper is sized to
                the SCALED dimensions and clips, and the card scales from its
                top-left corner so the visible result lands exactly inside. */}
            <View
              style={{
                alignSelf: 'center',
                marginTop: 18,
                width: (format === 'story' ? STORY_W : SQUARE) * scale,
                height: (format === 'story' ? STORY_H : SQUARE) * scale,
                borderRadius: 14,
                overflow: 'hidden',
                borderWidth: hairline,
                borderColor: colors.strokeSubtle,
              }}
            >
              <View
                style={{
                  width: format === 'story' ? STORY_W : SQUARE,
                  height: format === 'story' ? STORY_H : SQUARE,
                  transform: [{ scale }],
                  transformOrigin: 'top left',
                }}
              >
                <InviteCard challenge={challenge} format={format} />
              </View>
            </View>

            <View style={{ marginTop: 22 }}>
              <Button label={t.shareCard.share} onPress={doShare} disabled={busy} />
            </View>

            {/* A row so SecondaryAction's flex:1 fills the width — the same
                outlined pill as below, just on its own line. */}
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <SecondaryAction label={t.shareCard.shareLink} onPress={doShareLink} disabled={busy} />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <SecondaryAction label={t.shareCard.saveImage} onPress={doSave} disabled={busy} />
              <SecondaryAction label={t.shareCard.copyLink} onPress={doCopy} disabled={busy} />
            </View>

            <AppText
              variant="meta"
              color={colors.textTertiary}
              style={{ textAlign: 'center', marginTop: 14 }}
            >
              {t.shareCard.linkNote}
            </AppText>
          </Animated.View>
        </View>
      </Animated.View>

      {/* The capture source: full size, off-screen. Rendered rather than
          hidden with display:none — a view that isn't laid out can't be
          captured. */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <View ref={shotRef} collapsable={false}>
          <InviteCard challenge={challenge} format={format} />
        </View>
      </View>
    </Modal>
  );
}
