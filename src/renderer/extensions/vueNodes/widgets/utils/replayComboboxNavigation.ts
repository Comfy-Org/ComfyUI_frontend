const NAVIGATION_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'Home',
  'End',
  'PageDown',
  'PageUp',
  'Enter'
])

export function replayComboboxNavigation(event: KeyboardEvent) {
  if (!event.isTrusted || event.isComposing || !NAVIGATION_KEYS.has(event.key))
    return
  const { target } = event
  event.preventDefault()
  event.stopPropagation()
  requestAnimationFrame(() =>
    target?.dispatchEvent(new KeyboardEvent(event.type, event))
  )
}
