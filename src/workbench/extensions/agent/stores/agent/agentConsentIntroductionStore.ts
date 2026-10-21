import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAgentConsentIntroductionStore = defineStore(
  'agentConsentIntroduction',
  () => {
    const isContinuingSignIn = ref(false)
    const hasResponded = useStorage(
      'Comfy.AgentConsent.DesktopResponded',
      false,
      undefined,
      { writeDefaults: false, flush: 'sync' }
    )

    function markResponded(): void {
      hasResponded.value = true
    }

    return { hasResponded, markResponded, isContinuingSignIn }
  }
)
