import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Synchronously readable inputs to `commandStore.execute`. Written by the
 * surface that owns each policy; the command store only reads them.
 */
export const useCommandPolicyStore = defineStore('commandPolicy', () => {
  const graphMutationsLocked = ref(false)
  return { graphMutationsLocked }
})
