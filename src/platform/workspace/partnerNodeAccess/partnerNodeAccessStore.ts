import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import { useNodeDefStore } from '@/stores/nodeDefStore'
import { getProviderName } from '@/utils/categoryUtil'

export interface PartnerNodeEntry {
  name: string
  displayName: string
  partner: string
}

interface PersistedAccessState {
  overrides: Record<string, boolean>
  autoEnableNew: boolean
}

/**
 * PROTOTYPE (DES-484): persisted per-browser via localStorage. The
 * production version reads/writes `/api/workspace/partner-nodes` and is
 * enforced server-side at `/prompt`; this store's public shape mirrors
 * that contract so consumers survive the swap.
 */
const STORAGE_KEY = 'Comfy.Prototype.PartnerNodeAccess'

export function normalizeProviderKey(provider: string): string {
  return provider.toLowerCase().replaceAll(/\s+/g, '-')
}

export const usePartnerNodeAccessStore = defineStore(
  'partnerNodeAccess',
  () => {
    const nodeDefStore = useNodeDefStore()

    const persisted = useLocalStorage<PersistedAccessState>(STORAGE_KEY, {
      overrides: {},
      autoEnableNew: true
    })

    const partnerNodes = computed<PartnerNodeEntry[]>(() =>
      Object.values(nodeDefStore.nodeDefsByName)
        .filter((def) => def.api_node)
        .map((def) => ({
          name: def.name,
          displayName: def.display_name,
          partner: getProviderName(def.category)
        }))
    )

    const autoEnableNew = computed(() => persisted.value.autoEnableNew)

    function isNodeTypeEnabled(name: string): boolean {
      return persisted.value.overrides[name] ?? persisted.value.autoEnableNew
    }

    const disabledNodeTypes = computed<Set<string>>(
      () =>
        new Set(
          partnerNodes.value
            .filter((node) => !isNodeTypeEnabled(node.name))
            .map((node) => node.name)
        )
    )

    /** Partners whose nodes are all disabled, as normalized provider keys. */
    const fullyDisabledPartners = computed<Set<string>>(() => {
      const partnerHasEnabledNode = new Map<string, boolean>()
      for (const node of partnerNodes.value) {
        const key = normalizeProviderKey(node.partner)
        const anyEnabled = partnerHasEnabledNode.get(key) ?? false
        partnerHasEnabledNode.set(
          key,
          anyEnabled || isNodeTypeEnabled(node.name)
        )
      }
      return new Set(
        [...partnerHasEnabledNode]
          .filter(([, anyEnabled]) => !anyEnabled)
          .map(([key]) => key)
      )
    })

    function setEnabled(names: string[], enabled: boolean) {
      const overrides = { ...persisted.value.overrides }
      for (const name of names) {
        overrides[name] = enabled
      }
      persisted.value = { ...persisted.value, overrides }
    }

    function setAutoEnableNew(enabled: boolean) {
      persisted.value = { ...persisted.value, autoEnableNew: enabled }
    }

    return {
      partnerNodes,
      autoEnableNew,
      disabledNodeTypes,
      fullyDisabledPartners,
      isNodeTypeEnabled,
      setEnabled,
      setAutoEnableNew
    }
  }
)
