import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { getProviderName } from '@/utils/categoryUtil'

export interface PartnerNodePrototypeEntry {
  name: string
  displayName: string
  provider: string
}

interface PersistedPrototypeState {
  enabledNodeTypesByWorkspace: Record<string, Record<string, boolean>>
}

const STORAGE_KEY = 'Comfy.Prototype.PartnerNodeVisibility'

export const usePartnerNodePrototypeStore = defineStore(
  'partnerNodePrototype',
  () => {
    const nodeDefStore = useNodeDefStore()
    const workspaceStore = useTeamWorkspaceStore()
    const persisted = useLocalStorage<PersistedPrototypeState>(STORAGE_KEY, {
      enabledNodeTypesByWorkspace: {}
    })

    const prototypeWorkspaceId = computed(() => {
      const workspace = workspaceStore.activeWorkspace
      if (workspace?.type !== 'team' || workspace.role !== 'owner') return null
      return workspace.id
    })

    const enabledNodeTypes = computed(() => {
      const workspaceId = prototypeWorkspaceId.value
      if (!workspaceId) return {}
      return persisted.value.enabledNodeTypesByWorkspace[workspaceId] ?? {}
    })

    const partnerNodes = computed<PartnerNodePrototypeEntry[]>(() =>
      Object.values(nodeDefStore.nodeDefsByName)
        .filter((nodeDef) => nodeDef.api_node)
        .map((nodeDef) => ({
          name: nodeDef.name,
          displayName: nodeDef.display_name,
          provider: getProviderName(nodeDef.category)
        }))
    )

    function isEnabled(nodeType: string): boolean {
      return enabledNodeTypes.value[nodeType] ?? false
    }

    const disabledNodeTypes = computed(() => {
      if (!prototypeWorkspaceId.value) return new Set<string>()
      return new Set(
        partnerNodes.value
          .filter((node) => !isEnabled(node.name))
          .map((node) => node.name)
      )
    })

    function setEnabled(nodeTypes: string[], enabled: boolean) {
      const workspaceId = prototypeWorkspaceId.value
      if (!workspaceId) return
      const nextEnabledNodeTypes = { ...enabledNodeTypes.value }
      for (const nodeType of nodeTypes) {
        nextEnabledNodeTypes[nodeType] = enabled
      }
      persisted.value = {
        enabledNodeTypesByWorkspace: {
          ...persisted.value.enabledNodeTypesByWorkspace,
          [workspaceId]: nextEnabledNodeTypes
        }
      }
    }

    return {
      partnerNodes,
      disabledNodeTypes,
      isEnabled,
      setEnabled
    }
  }
)
