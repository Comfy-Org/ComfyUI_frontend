import { useMutationObserver, useResizeObserver } from '@vueuse/core'
import { debounce } from 'lodash'
import { readonly, ref } from 'vue'

/**
 * Observes an element for overflow changes and optionally debounces the check
 * @param element - The element to observe
 * @param options - The options for the observer
 * @param options.debounceTime - The time to debounce the check in milliseconds
 * @param options.useMutationObserver - Whether to use a mutation observer to check for overflow
 * @param options.useResizeObserver - Whether to use a resize observer to check for overflow
 * @returns An object containing the isOverflowing state and the checkOverflow function to manually trigger
 */
export const useOverflowObserver = (
  element: HTMLElement,
  options: {
    debounceTime?: number
    useMutationObserver?: boolean
    useResizeObserver?: boolean
  } = {
    debounceTime: 10,
    useMutationObserver: true,
    useResizeObserver: true
  }
) => {
  const isOverflowing = ref(false)

  const checkOverflowFn = () => {
    isOverflowing.value = element.scrollWidth > element.clientWidth
  }

  const checkOverflow = options.debounceTime
    ? debounce(checkOverflowFn, options.debounceTime)
    : checkOverflowFn

  if (options.useMutationObserver) {
    useMutationObserver(element, checkOverflow, {
      subtree: true,
      childList: true
    })
  }
  if (options.useResizeObserver) {
    useResizeObserver(element, checkOverflow)
  }

  return { isOverflowing: readonly(isOverflowing), checkOverflow }
}
