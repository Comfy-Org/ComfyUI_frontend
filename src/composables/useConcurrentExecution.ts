import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSettingStore } from '@/platform/settings/settingStore'

export function useConcurrentExecution() {
  const settingStore = useSettingStore()
  const { flags } = useFeatureFlags()

  const isFeatureEnabled = computed(
    () => flags.concurrentExecutionEnabled === true
  )

  const isUserEnabled = computed(
    () => settingStore.get('Comfy.Cloud.ConcurrentExecution') === true
  )

  const isConcurrentExecutionEnabled = computed(
    () => isFeatureEnabled.value && isUserEnabled.value
  )

  const maxConcurrentJobs = computed(() => flags.maxConcurrentJobs as number)

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
