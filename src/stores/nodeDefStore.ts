import { defineStore } from 'pinia'
import { NodeSearchService } from '@/services/nodeSearchService'
import { ComfyNodeDef } from '@/types/apiTypes'
import { SYSTEM_NODE_DEFS } from '@/stores/data'

const SYSTEM_NODE_DEFS_BY_NAME = SYSTEM_NODE_DEFS.reduce((acc, nodeDef) => {
  acc[nodeDef.name] = nodeDef
  return acc
}, {}) as Record<string, ComfyNodeDef>

interface State {
  nodeDefsByName: Record<string, ComfyNodeDef>
}

export const useNodeDefStore = defineStore('nodeDef', {
  state: (): State => ({
    nodeDefsByName: SYSTEM_NODE_DEFS_BY_NAME
  }),

  getters: {
    nodeDefs(state) {
      return Object.values(state.nodeDefsByName)
    },
    nodeSearchService(state) {
      return new NodeSearchService(Object.values(state.nodeDefsByName))
    }
  },

  actions: {
    addNodeDef(nodeDef: ComfyNodeDef) {
      this.nodeDefsByName[nodeDef.name] = nodeDef
    },

    addNodeDefs(nodeDefs: ComfyNodeDef[]) {
      for (const nodeDef of nodeDefs) {
        this.nodeDefsByName[nodeDef.name] = nodeDef
      }
    }
  }
})
