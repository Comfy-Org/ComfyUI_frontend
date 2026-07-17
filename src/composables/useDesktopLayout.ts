import {
  breakpointsTailwind,
  createSharedComposable,
  useBreakpoints
} from '@vueuse/core'

/** `md`+ viewport — the width the onboarding tours need to place their coach-marks. */
export const useDesktopLayout = createSharedComposable(() =>
  useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
)
