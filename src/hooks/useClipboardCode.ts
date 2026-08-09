import { useCallback, useRef } from 'react';
import * as Clipboard from 'expo-clipboard';
import { extractCode } from '@/lib/invite';

/**
 * Fills the invite field from the clipboard when the field is focused.
 *
 * Reading the pasteboard raises iOS's own "Allow Paste?" prompt, and that is
 * fine — it's Apple's sheet, not a control this app draws, and granting it is
 * the whole consent step. Auto-filling afterwards is deliberate: the person
 * already said yes, and asking again with a suggestion chip would just be a
 * second confirmation for a decision they've made.
 *
 * The read happens once per mount, only from onFocus. Never on launch, never
 * on a timer, never on navigation. The value is matched against the same
 * extractCode() that validates typing, and anything that isn't an invite code
 * is dropped without touching the field — so an ordinary sentence on the
 * clipboard leaves the screen exactly as it was. Nothing is logged, stored or
 * sent anywhere.
 */
export function useClipboardCode(onFound: (code: string) => void) {
  const alreadyRead = useRef(false);
  const handler = useRef(onFound);
  handler.current = onFound;

  return useCallback(() => {
    // Once per mount: focus comes and goes as people tap in and out of the
    // field, and re-reading would mean re-prompting.
    if (alreadyRead.current) return;
    alreadyRead.current = true;

    Clipboard.getStringAsync()
      .then((text) => {
        const code = extractCode(text);
        if (code) handler.current(code);
      })
      // Declined permission, empty clipboard, anything else — the field is
      // left alone and typing still works.
      .catch(() => {});
  }, []);
}
