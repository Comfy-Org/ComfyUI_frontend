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

function readAncestorScrollTops(
  element: Element | null | undefined
): Map<Element, number> {
  const scrollTops = new Map<Element, number>()
  for (let node = element?.parentElement; node; node = node.parentElement)
    scrollTops.set(node, node.scrollTop)
  return scrollTops
}

function wasClampedFrom(previousTop: number | undefined, scroller: Element) {
  const maxTop = scroller.scrollHeight - scroller.clientHeight
  return (
    previousTop !== undefined &&
    previousTop > maxTop &&
    Math.abs(scroller.scrollTop - maxTop) <= 1
  )
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
  let mayClampScroll = false
  let clampedScrollers = new WeakSet<Element>()
  let ancestorScrollTops = new Map<Element, number>()
  watch(
    open,
    (isOpen) => {
      if (!isOpen) return
      viewportSize = readViewportSize()
      mayClampScroll = false
      clampedScrollers = new WeakSet()
      ancestorScrollTops = readAncestorScrollTops(toValue(anchor))
    },
    { immediate: true }
  )

  function movesAnchor(target: EventTarget | null): boolean {
    return (
      target === document ||
      target instanceof Window ||
      (target instanceof Element && target.contains(toValue(anchor) ?? null))
    )
  }

  function isClampAfterGrowth(scroller: Element): boolean {
    return (
      mayClampScroll &&
      !clampedScrollers.has(scroller) &&
      wasClampedFrom(ancestorScrollTops.get(scroller), scroller)
    )
  }

  useEventListener(
    () => (open.value ? window : undefined),
    'resize',
    () => {
      const next = readViewportSize()
      if (!viewportSize || !isOnScreenKeyboardResize(viewportSize, next)) {
        open.value = false
        return
      }
      if (next.height > viewportSize.height) {
        mayClampScroll = true
        clampedScrollers = new WeakSet()
      }
      viewportSize = next
    }
  )
  useEventListener(
    () => (open.value ? window : undefined),
    'scroll',
    (event) => {
      const target = event.target
      if (!movesAnchor(target)) return
      if (!(target instanceof Element) || !isClampAfterGrowth(target)) {
        open.value = false
        return
      }
      clampedScrollers.add(target)
      ancestorScrollTops.set(target, target.scrollTop)
    },
    { capture: true }
  )
}
