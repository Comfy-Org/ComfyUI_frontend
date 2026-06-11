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
 * Detects whether a single-line, ellipsis-truncated element is actually
 * clipping its text. `scrollWidth > clientWidth` is unreliable for
 * `text-overflow: ellipsis` in Chrome (it often reports equal), so the source
 * of truth is measuring the full text with a hidden clone that copies the
 * element's font metrics, then comparing against the available content width.
 */
export function isTextOverflowing(el: HTMLElement): boolean {
  const contentWidth = el.clientWidth
  if (contentWidth <= 0) return false

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

  return textWidth > contentWidth + 0.5
}
