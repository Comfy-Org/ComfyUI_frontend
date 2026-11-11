const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit'
])

/**
 * What an Enter key press means in one of the layer's text fields, taking
 * the key so that the page does nothing with it. A press with Cmd or Ctrl
 * is also kept from every later listener: the app binds those to running
 * the workflow.
 */
export function takeEnter(
  event: KeyboardEvent
): 'newLine' | 'enter' | 'sendNow' | 'nothing' {
  if (event.isComposing) return 'nothing'
  const hasCommandKey = event.metaKey || event.ctrlKey
  if (hasCommandKey) event.stopPropagation()
  if (event.shiftKey && !hasCommandKey) return 'newLine'
  event.preventDefault()
  if (event.shiftKey || event.altKey) return 'nothing'
  return hasCommandKey ? 'sendNow' : 'enter'
}

/** True when a key typed at this target belongs to a text field. */
export function isTextEntry(target: EventTarget | null | undefined): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLInputElement)
    return !NON_TEXT_INPUT_TYPES.has(target.type)
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
    return true
  return (
    target.isContentEditable ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null
  )
}
