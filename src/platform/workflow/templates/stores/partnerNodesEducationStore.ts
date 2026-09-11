import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * Requests the one-off partner-nodes education card after a paid template
 * loads, keyed to the workflow that triggered it so the card retires when a
 * different workflow becomes active. Not persisted: it shows on every
 * paid-template load by design.
 */
export const usePartnerNodesEducationStore = defineStore(
  'partnerNodesEducation',
  () => {
    const requestedForWorkflowKey = ref<string | undefined>(undefined)

    const isCardRequested = computed(
      () => requestedForWorkflowKey.value !== undefined
    )

    const requestCard = (workflowKey: string) => {
      requestedForWorkflowKey.value = workflowKey
    }

    const dismissCard = () => {
      requestedForWorkflowKey.value = undefined
    }

    return {
      requestedForWorkflowKey,
      isCardRequested,
      requestCard,
      dismissCard
    }
  }
)
