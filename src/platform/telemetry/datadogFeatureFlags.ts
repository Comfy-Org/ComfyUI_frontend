// eslint-disable-next-line no-restricted-imports -- this telemetry sink owns native RUM feature flag reporting
import { datadogRum } from '@datadog/browser-rum'

const RESERVED_FLAG_KEY_CHARS = /[.:+\-=&|><!(){}[\]^"“”~*?\\\s]/g

export function trackDatadogFeatureFlagEvaluation(
  key: string,
  value: unknown
): void {
  datadogRum.addFeatureFlagEvaluation(
    key.replace(RESERVED_FLAG_KEY_CHARS, '_'),
    value
  )
}
