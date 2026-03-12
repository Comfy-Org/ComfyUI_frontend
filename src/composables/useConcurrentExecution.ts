import { computed } from 'vue'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useSettingStore } from '@/platform/settings/settingStore'

export function useConcurrentExecution() {
  const settingStore = useSettingStore()

  const isFeatureEnabled = computed(
    () => remoteConfig.value.concurrent_execution_enabled === true
  )

  const isUserEnabled = computed(
    () => settingStore.get('Comfy.Cloud.ConcurrentExecution') === true
  )

  const isConcurrentExecutionEnabled = computed(
    () => isFeatureEnabled.value && isUserEnabled.value
  )

  const maxConcurrentJobs = computed(
    () => remoteConfig.value.max_concurrent_jobs ?? 1
  )

  const hasSeenOnboarding = computed(
    () =>
      settingStore.get('Comfy.Cloud.ConcurrentExecution.OnboardingSeen') ===
      true
  )

  async function setUserEnabled(enabled: boolean) {
    await settingStore.set('Comfy.Cloud.ConcurrentExecution', enabled)
  }

  async function markOnboardingSeen() {
    await settingStore.set(
      'Comfy.Cloud.ConcurrentExecution.OnboardingSeen',
      true
    )
  }

  return {
    isFeatureEnabled,
    isUserEnabled,
    isConcurrentExecutionEnabled,
    maxConcurrentJobs,
    hasSeenOnboarding,
    setUserEnabled,
    markOnboardingSeen
  }
}
