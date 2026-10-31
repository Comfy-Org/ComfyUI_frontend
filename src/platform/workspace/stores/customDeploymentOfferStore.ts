import { defineStore } from 'pinia'

/** Which sets of missing node types the custom deployment dialog already opened for on its own on this page. */
export const useCustomDeploymentOfferStore = defineStore(
  'customDeploymentOffer',
  () => {
    const offeredFor = new Set<string>()

    function offerOnce(nodeTypeNames: readonly string[]): boolean {
      const key = [...nodeTypeNames].sort().join('\n')
      if (offeredFor.has(key)) return false
      offeredFor.add(key)
      return true
    }

    return { offerOnce }
  }
)
