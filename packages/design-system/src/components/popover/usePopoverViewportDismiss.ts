import { useEventListener } from '@vueuse/core'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { toValue, watch } from 'vue'

type ViewportSize = { width: number; height: number }

const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number'
])

function opensOnScreenKeyboard(element: Element | null): boolean {
  if (!(element instanceof HTMLElement) || element.inputMode === 'none')
    return false
  if (element instanceof HTMLInputElement)
    return TEXT_INPUT_TYPES.has(element.type) && !element.readOnly
  if (element instanceof HTMLTextAreaElement) return !element.readOnly
  return element.isContentEditable
}

function readViewportSize(): ViewportSize {
  return { width: window.innerWidth, height: window.innerHeight }
}

function isOnScreenKeyboardResize(
  previous: ViewportSize,
  next: ViewportSize
): boolean {
  if (!window.matchMedia('(pointer: coarse)').matches) return false
  if (next.width !== previous.width) return false
  return (
    next.height >= previous.height ||
    opensOnScreenKeyboard(document.activeElement)
  )
}

export function usePopoverViewportDismiss(
  open: Ref<boolean>,
  anchor: MaybeRefOrGetter<Element | null | undefined>
) {
  let viewportSize: ViewportSize | undefined
  watch(
    open,
    (isOpen) => {
      if (isOpen) viewportSize = readViewportSize()
    },
    { immediate: true }
  )

  useEventListener(
    () => (open.value ? window : undefined),
    'resize',
    () => {
      const next = readViewportSize()
      if (!viewportSize || !isOnScreenKeyboardResize(viewportSize, next)) {
        open.value = false
        return
      }
      viewportSize = next
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
