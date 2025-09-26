import { useEventListener } from '@vueuse/core'

const PRIMEVUE_SCROLLABLE_CLASSES = new Set([
  'p-select-option',
  'p-dropdown-item'
])

const PRIMEVUE_SCROLLABLE_CONTAINERS = [
  '.p-select',
  '.p-multiselect',
  '.p-treeselect',
  '.p-select-dropdown',
  '.p-dropdown-panel'
].join(', ')

/**
 * Check if an element should handle wheel events natively (scrolling)
 * instead of letting them bubble to canvas zoom
 */
function isScrollableElement(target: Element): boolean {
  // Check common scrollable elements
  const tagName = target.tagName.toLowerCase()
  if (tagName === 'textarea' || tagName === 'select' || tagName === 'input') {
    return true
  }

  // Check PrimeVue select options and other dropdown elements
  for (const className of target.classList) {
    if (PRIMEVUE_SCROLLABLE_CLASSES.has(className)) {
      return true
    }
  }

  if (target.closest(PRIMEVUE_SCROLLABLE_CONTAINERS)) {
    return true
  }

  // Check for elements with scrollable overflow
  const computedStyle = window.getComputedStyle(target)
  const overflowY = computedStyle.overflowY
  if (overflowY === 'scroll' || overflowY === 'auto') {
    return true
  }

  // Check if element has scrollable content
  if (target.scrollHeight > target.clientHeight && overflowY !== 'hidden') {
    return true
  }

  return false
}

/**
 * App-level composable that preserves native scrolling behavior in widgets
 * by preventing wheel events from bubbling to the canvas zoom handler.
 * Call once at the app level to enable native scrolling in textareas, selects, etc.
 */
export function usePreserveWidgetScroll() {
  useEventListener(
    window,
    'wheel',
    (event: WheelEvent) => {
      if (
        event.target instanceof Element &&
        isScrollableElement(event.target)
      ) {
        event.stopPropagation()
      }
    },
    { capture: true, passive: false }
  )
}
