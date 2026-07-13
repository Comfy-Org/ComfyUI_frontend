import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Seam between the persistence layer and the onboarding Getting Started screen.
 *
 * `loadDefaultWorkflow` decides when a fresh user should land on Getting
 * Started, but the screen lives in `renderer/` and cannot be imported from this
 * layer. Both sides share this flag: persistence turns it on; the
 * renderer-mounted overlay shows itself while set and clears it on exit.
 */
export const useOnboardingEntryStore = defineStore('onboardingEntry', () => {
  const shouldShowGettingStarted = ref(false)

  function showGettingStarted() {
    shouldShowGettingStarted.value = true
  }

  function dismissGettingStarted() {
    shouldShowGettingStarted.value = false
  }

  return { shouldShowGettingStarted, showGettingStarted, dismissGettingStarted }
})
