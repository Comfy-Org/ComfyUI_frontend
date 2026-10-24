/**
 * Mask-based icons are painted with `background-color: currentColor`, which
 * forced-colors mode (Windows High Contrast) overrides with the page
 * background, making them invisible. Repaint them in the theme's text color.
 */
export function withForcedColors(rules) {
  if (!('mask-image' in rules)) return rules
  return {
    ...rules,
    '@media (forced-colors: active)': {
      'forced-color-adjust': 'none',
      'background-color': 'CanvasText'
    }
  }
}
