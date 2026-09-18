import { vi } from 'vitest'
import type { datadogRum as realDatadogRum } from '@datadog/browser-rum'

export const datadogRum: Pick<
  typeof realDatadogRum,
  'getInitConfiguration' | 'init' | 'setGlobalContextProperty'
> = {
  getInitConfiguration: vi.fn(),
  init: vi.fn(),
  setGlobalContextProperty: vi.fn()
}
