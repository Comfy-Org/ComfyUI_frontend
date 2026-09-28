import type { FeatureFlagsCallback } from 'posthog-js'

export interface FlagReader {
  get_distinct_id(): string
  isFeatureEnabled(flag: string): boolean | undefined
  onFeatureFlags(callback: FeatureFlagsCallback): unknown
}

export function loadPostHogFlags(): Promise<FlagReader> {
  return import('posthog-js').then((module) => module.default)
}
