import { onTestFinished, vi } from 'vitest'
import type { DatadogRum as RealDatadogRum } from '@datadog/browser-rum'

type DatadogRum = Pick<
  RealDatadogRum,
  | 'getGlobalContext'
  | 'getInitConfiguration'
  | 'init'
  | 'setGlobalContextProperty'
>

const context: ReturnType<DatadogRum['getGlobalContext']> = {}
let contextCleanupRegistered = false

export const datadogRum = vi.mockObject<DatadogRum>(
  {
    getGlobalContext: () => context,
    getInitConfiguration: () => undefined,
    init: () => {},
    setGlobalContextProperty: (key, value) => {
      if (!contextCleanupRegistered) {
        onTestFinished(() => {
          for (const key of Object.keys(context)) delete context[key]
          contextCleanupRegistered = false
        })
        contextCleanupRegistered = true
      }
      context[key] = value
    }
  },
  { spy: true }
)
