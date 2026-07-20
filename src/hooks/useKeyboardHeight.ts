import { useEffect, useState } from 'react';
import { Keyboard, KeyboardEvent, Platform } from 'react-native';

/**
 * The keyboard's current height in px (0 when hidden), straight from the
 * keyboard events. Used by the bottom sheets instead of KeyboardAvoidingView:
 * KAV measures its own frame RELATIVE TO ITS PARENT but compares it against
 * the keyboard's SCREEN coordinates, so inside an absolutely-positioned
 * overlay (all our sheets) it under-pads by the parent's screen offset and
 * the input stays partly covered. Listening to the real keyboard height and
 * padding by exactly that amount has no such frame-of-reference problem.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS fires the richer "will" events; Android only has "did".
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e: KeyboardEvent) =>
      setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
