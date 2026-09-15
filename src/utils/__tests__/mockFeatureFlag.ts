import { vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'

type FeatureFlags = ReturnType<typeof useFeatureFlags>['flags']

export function mockFeatureFlag<Key extends keyof FeatureFlags>(
  key: Key,
  value: FeatureFlags[Key]
) {
  const featureFlags = useFeatureFlags()
  vi.mocked(useFeatureFlags).mockReturnValue(featureFlags)
  vi.spyOn(featureFlags.flags, key, 'get').mockReturnValue(value)
}
