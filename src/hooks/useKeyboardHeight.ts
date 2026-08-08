import { useEffect, useState } from 'react';
import { Keyboard, KeyboardEvent, Platform } from 'react-native';

/**
 * The keyboard's current height in px (0 when hidden), straight from the
 * keyboard events. Used by the bottom sheets instead of KeyboardAvoidingView.
 *
 * KAV is the wrong tool here for a reason that isn't obvious until you hit
 * it: it learns the keyboard height ONLY from an event it receives while
 * mounted, and its initial state is zero. A sheet mounts when it's opened, so
 * one that opens while the keyboard is already up — the second sheet in a row,
 * every time — never sees an event and pads by nothing. That is the exact
 * shape of "the first one works and the rest don't".
 *
 * This hook has no such window because the sheet components are mounted for
 * the life of the screen (they return null internally when hidden), so the
 * listeners are always attached. `Keyboard.metrics()` closes the remaining
 * gap for anything that really does mount late.
 */
export function useKeyboardHeight(): number {
  // Seeded, not zero: a component mounting while the keyboard is already up
  // gets no show event, and starting at zero would leave it padding by
  // nothing until the next time the keyboard moves.
  const [height, setHeight] = useState(() => Keyboard.metrics()?.height ?? 0);

  useEffect(() => {
    // iOS fires the richer "will" events; Android only has "did".
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => setHeight(e.endCoordinates.height);
    const show = Keyboard.addListener(showEvent, onShow);
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    // Backstop for the case where focus moves straight from one field to
    // another and iOS coalesces the transition into a single "did" event
    // (or none at all) — cheap, and it can only ever correct the height.
    const settled =
      Platform.OS === 'ios' ? Keyboard.addListener('keyboardDidShow', onShow) : null;
    return () => {
      show.remove();
      hide.remove();
      settled?.remove();
    };
  }, []);

  return height;
}
