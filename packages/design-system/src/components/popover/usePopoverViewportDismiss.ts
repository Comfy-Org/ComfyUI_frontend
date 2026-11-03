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

export function usePopoverViewportDismiss(
  open: Ref<boolean>,
  anchor: MaybeRefOrGetter<Element | null | undefined>
) {
  let openedSize: ViewportSize | undefined
  let keyboardViewportHeight: number | undefined
  watch(
    open,
    (isOpen) => {
      if (!isOpen) return
      openedSize = readViewportSize()
      keyboardViewportHeight = undefined
    },
    { immediate: true }
  )

  function isKeyboardClosing(opened: ViewportSize, nextHeight: number) {
    return (
      keyboardViewportHeight !== undefined &&
      nextHeight >= keyboardViewportHeight &&
      nextHeight <= opened.height
    )
  }

  function isOnScreenKeyboardResize(): boolean {
    if (!openedSize || !window.matchMedia('(pointer: coarse)').matches)
      return false
    const next = readViewportSize()
    if (next.width !== openedSize.width) return false
    return (
      opensOnScreenKeyboard(document.activeElement) ||
      isKeyboardClosing(openedSize, next.height)
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
      keyboardViewportHeight = window.innerHeight
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
