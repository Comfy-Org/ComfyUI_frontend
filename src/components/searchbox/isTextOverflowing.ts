const FONT_PROPS = [
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontFamily',
  'letterSpacing',
  'textTransform',
  'wordSpacing'
] as const

/**
 * Measures the full, unclipped width of an element's text by rendering it in a
 * hidden clone that copies the element's font metrics. `scrollWidth` is
 * unreliable for `text-overflow: ellipsis` in Chrome (it often reports equal to
 * `clientWidth`), so the clone is the source of truth.
 */
export function measureTextWidth(el: HTMLElement): number {
  const style = getComputedStyle(el)
  const clone = document.createElement('span')
  clone.textContent = el.textContent ?? ''
  clone.style.position = 'fixed'
  clone.style.top = '-9999px'
  clone.style.left = '-9999px'
  clone.style.visibility = 'hidden'
  clone.style.whiteSpace = 'nowrap'
  for (const prop of FONT_PROPS) clone.style[prop] = style[prop]

  document.body.appendChild(clone)
  const textWidth = clone.getBoundingClientRect().width
  clone.remove()

  return textWidth
}

/**
 * Detects whether a single-line, ellipsis-truncated element is actually
 * clipping its text by comparing its full text width against the available
 * content width.
 */
export function isTextOverflowing(el: HTMLElement): boolean {
  const contentWidth = el.clientWidth
  if (contentWidth <= 0) return false
  return measureTextWidth(el) > contentWidth + 0.5
}
