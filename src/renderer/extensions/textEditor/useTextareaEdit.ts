import { useEventListener } from '@vueuse/core'

interface TextSnapshot {
  value: string
  start: number
  end: number
}

type TextEditResult =
  | { ok: true }
  | { ok: false; reason: 'maxlength' | 'unavailable' }

function sameSnapshot(current: TextSnapshot, previous: TextSnapshot): boolean {
  return (
    current.value === previous.value &&
    current.start === previous.start &&
    current.end === previous.end
  )
}

export function useTextareaEdit(
  element: () => HTMLTextAreaElement | HTMLInputElement | undefined,
  enabled: () => boolean
) {
  let composing = false
  useEventListener(element, 'compositionstart', () => (composing = true))
  useEventListener(element, 'compositionend', () => (composing = false))

  function snapshot(): TextSnapshot | undefined {
    const input = element()
    if (
      !input ||
      !enabled() ||
      input.readOnly ||
      input.disabled ||
      composing ||
      input.selectionStart === null ||
      input.selectionEnd === null
    )
      return undefined
    return {
      value: input.value,
      start: input.selectionStart,
      end: input.selectionEnd
    }
  }

  function replace(
    previous: TextSnapshot,
    range: { from: number; to: number },
    text: string
  ): TextEditResult {
    const input = element()
    const current = snapshot()
    if (!input || !current || !sameSnapshot(current, previous))
      return { ok: false, reason: 'unavailable' }
    if (
      input.maxLength >= 0 &&
      current.value.length - (range.to - range.from) + text.length >
        input.maxLength
    )
      return { ok: false, reason: 'maxlength' }
    if (typeof document.execCommand !== 'function')
      return { ok: false, reason: 'unavailable' }
    input.focus()
    input.setSelectionRange(range.from, range.to)
    const applied = document.execCommand('insertText', false, text)
    if (!applied) input.setSelectionRange(previous.start, previous.end)
    return applied ? { ok: true } : { ok: false, reason: 'unavailable' }
  }

  return { snapshot, replace }
}
