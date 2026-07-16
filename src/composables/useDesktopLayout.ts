import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'

/** `md`+ viewport — the width the onboarding tours need to place their coach-marks. */
export function useDesktopLayout() {
  return useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
}
