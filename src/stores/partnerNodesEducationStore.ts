import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Requests showing the one-off "this template uses partner nodes" education
 * card after a paid template loads. Not persisted: the card shows on every
 * paid-template load by design.
 */
export const usePartnerNodesEducationStore = defineStore(
  'partnerNodesEducation',
  () => {
    const isCardRequested = ref(false)

    const requestCard = () => {
      isCardRequested.value = true
    }

    const dismissCard = () => {
      isCardRequested.value = false
    }

    return { isCardRequested, requestCard, dismissCard }
  }
)
