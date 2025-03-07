import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { ref, watch } from 'vue'

type BreakpointKey = keyof typeof breakpointsTailwind

/**
 * Composable for element with responsive collapsed state
 * @param breakpointThreshold - Breakpoint at which the element should become collapsible
 */
export const useResponsiveCollapse = (
  breakpointThreshold: BreakpointKey = 'lg'
) => {
  const breakpoints = useBreakpoints(breakpointsTailwind)

  const isSmallScreen = breakpoints.smallerOrEqual(breakpointThreshold)
  const isOpen = ref(!isSmallScreen.value)

  /**
   * Handles screen size changes to automatically open/close the element
   * when crossing the breakpoint threshold
   */
  const onIsSmallScreenChange = () => {
    if (isSmallScreen.value && isOpen.value) {
      isOpen.value = false
    } else if (!isSmallScreen.value && !isOpen.value) {
      isOpen.value = true
    }
  }

  watch(isSmallScreen, onIsSmallScreenChange)

  return {
    breakpoints,
    isOpen,
    isSmallScreen,

    open: () => (isOpen.value = true),
    close: () => (isOpen.value = false),
    toggle: () => (isOpen.value = !isOpen.value)
  }
}
