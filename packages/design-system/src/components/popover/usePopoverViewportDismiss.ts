import { useEventListener } from '@vueuse/core'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { toValue, watch } from 'vue'

const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number'
])

function isTextEntryFocused(): boolean {
  const focused = document.activeElement
  if (focused instanceof HTMLInputElement)
    return TEXT_INPUT_TYPES.has(focused.type)
  return (
    focused instanceof HTMLTextAreaElement ||
    (focused instanceof HTMLElement && focused.isContentEditable)
  )
}

function readViewportSize() {
  return { width: window.innerWidth, height: window.innerHeight }
}

export function usePopoverViewportDismiss(
  open: Ref<boolean>,
  anchor: MaybeRefOrGetter<Element | null | undefined>
) {
  let viewportSize = readViewportSize()
  watch(open, (isOpen) => {
    if (isOpen) viewportSize = readViewportSize()
  })

  function isOnScreenKeyboardResize(): boolean {
    const next = readViewportSize()
    return (
      window.matchMedia('(pointer: coarse)').matches &&
      isTextEntryFocused() &&
      next.width === viewportSize.width &&
      next.height !== viewportSize.height
    )
  }

  useEventListener(
    () => (open.value ? window : undefined),
    'resize',
    () => {
      if (!isOnScreenKeyboardResize()) {
        open.value = false
        return
      }
      viewportSize = readViewportSize()
    }
  )
  useEventListener(
    () => (open.value ? window : undefined),
    'scroll',
    (event) => {
      if (
        event.target === document ||
        event.target instanceof Window ||
        (event.target instanceof Element &&
          event.target.contains(toValue(anchor) ?? null))
      )
        open.value = false
    },
    { capture: true }
  )
}
