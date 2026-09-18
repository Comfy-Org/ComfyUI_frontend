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

export const datadogRum = vi.mockObject<DatadogRum>(
  {
    getGlobalContext: () => context,
    getInitConfiguration: () => undefined,
    init: () => {},
    setGlobalContextProperty: (key, value) => {
      onTestFinished(() => {
        for (const key of Object.keys(context)) delete context[key]
      })
      context[key] = value
    }
  },
  { spy: true }
)
