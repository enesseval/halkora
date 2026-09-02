import { useWindowDimensions } from 'react-native';

/**
 * The one place that decides how wide the app is allowed to get.
 *
 * Every screen was written flex-first with nothing but a 20pt gutter, which
 * is right on a phone and wrong the moment the window is 1024pt across: a
 * settings row stretches an arm's length, one line of body text runs 120
 * characters, and the whole thing reads as a phone app someone pulled at the
 * corners (saha testi bulgusu — "ipad ekranında app çok dağılmış ve geniş
 * gözüküyor").
 *
 * The fix is not a separate iPad layout. It is a maximum measure: content
 * stays the width it was designed for and sits in the middle of whatever
 * space it is given. That is also what makes this safe to apply everywhere —
 * on a phone the cap is never reached, so nothing about the phone layout
 * changes.
 */

/** Past this the window is wider than any phone in portrait. */
const TABLET_MIN_WIDTH = 700;

/** The measure the app was designed at — a large phone, gutters included. */
const MAX_CONTENT_WIDTH = 560;

export interface Layout {
  width: number;
  height: number;
  /** Wide enough that full-bleed content would look stretched. */
  isTablet: boolean;
  /** How wide the content column may be, never more than the window. */
  contentWidth: number;
  /** Left/right space outside the content column. 0 on a phone. */
  sideGutter: number;
  /** Landscape — worth knowing for the sheets, which are bottom-anchored. */
  isLandscape: boolean;
}

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);
  return {
    width,
    height,
    isTablet,
    contentWidth,
    sideGutter: Math.max((width - contentWidth) / 2, 0),
    isLandscape: width > height,
  };
}

/**
 * Scale a design-time size for the current window WITHOUT letting it run
 * away. A share card drawn at the window's width is 1024pt wide on an iPad
 * and every font in it is drawn twice the size it was designed at (saha
 * testi bulgusu — "ipadde davet kısmında oluşturulan resimlerde puntolar çok
 * büyük"). Clamping the basis at the design width keeps one rendering.
 */
export function clampToDesign(available: number, design = MAX_CONTENT_WIDTH): number {
  return Math.min(available, design);
}

export { MAX_CONTENT_WIDTH, TABLET_MIN_WIDTH };
