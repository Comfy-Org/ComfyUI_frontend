import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

const DISMISSED_SETTING = 'Comfy.PartnerNodesEducation.Dismissed'

/**
 * Requests the partner-nodes education card after a paid template loads,
 * keyed to the workflow that triggered it so the card retires when a different
 * workflow becomes active. Shows on every paid-template load until the user
 * closes it, then never again.
 */
export const usePartnerNodesEducationStore = defineStore(
  'partnerNodesEducation',
  () => {
    const settingStore = useSettingStore()
    const requestedForWorkflowKey = ref<string | undefined>(undefined)

    const isCardRequested = computed(
      () => requestedForWorkflowKey.value !== undefined
    )

    const requestCard = (workflowKey: string) => {
      if (settingStore.get(DISMISSED_SETTING)) return
      requestedForWorkflowKey.value = workflowKey
    }

    const retireCard = () => {
      requestedForWorkflowKey.value = undefined
    }

    const dismissCard = () => {
      retireCard()
      void settingStore.set(DISMISSED_SETTING, true)
    }

    return {
      requestedForWorkflowKey,
      isCardRequested,
      requestCard,
      retireCard,
      dismissCard
    }
  }
)
