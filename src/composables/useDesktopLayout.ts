import {
  breakpointsTailwind,
  createSharedComposable,
  useBreakpoints
} from '@vueuse/core'

export const useDesktopLayout = createSharedComposable(() =>
  useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
)
