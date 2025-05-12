import {
  type ExportedSubgraph,
  type ExportedSubgraphInstance,
  type Subgraph
} from '@comfyorg/litegraph'

import type { ComfyWorkflowJSON } from '@/schemas/comfyWorkflowSchema'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { app as comfyApp } from '@/scripts/app'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import { useLitegraphService } from './litegraphService'

export const useSubgraphService = () => {
  const nodeDefStore = useNodeDefStore()

  /** Loads a single subgraph definition and registers it with the node def store */
  function registerLitegraphNode(
    nodeDef: ComfyNodeDefV1,
    subgraph: Subgraph,
    exportedSubgraph: ExportedSubgraph
  ) {
    const instanceData: ExportedSubgraphInstance = {
      id: -1,
      type: exportedSubgraph.id,
      pos: [0, 0],
      size: [100, 100],
      inputs: [],
      outputs: [],
      flags: {},
      order: 0,
      mode: 0
    }

    useLitegraphService().registerSubgraphNodeDef(
      nodeDef,
      subgraph,
      instanceData
    )
  }

  function createNodeDef(exportedSubgraph: ExportedSubgraph) {
    const { id, name } = exportedSubgraph

    const nodeDef: ComfyNodeDefV1 = {
      input: { required: {} },
      output: [],
      output_is_list: [],
      output_name: [],
      output_tooltips: [],
      name: id,
      display_name: name,
      description: `Subgraph node for ${name}`,
      category: 'subgraph',
      output_node: false,
      python_module: 'nodes'
    }

    nodeDefStore.addNodeDef(nodeDef)
    return nodeDef
  }

  /** Loads all exported subgraph definitions from workflow */
  function loadSubgraphs(graphData: ComfyWorkflowJSON) {
    const subgraphs = graphData.definitions?.subgraphs
    if (!subgraphs) return

    // Assertion: overriding Zod schema
    for (const subgraphData of subgraphs as ExportedSubgraph[]) {
      const subgraph =
        comfyApp.graph.subgraphs.get(subgraphData.id) ??
        comfyApp.graph.createSubgraph(subgraphData)

      registerNewSubgraph(subgraph, subgraphData)
    }
  }

  /** Registers a new subgraph (e.g. user converted from nodes) */
  function registerNewSubgraph(
    subgraph: Subgraph,
    exportedSubgraph: ExportedSubgraph
  ) {
    const nodeDef = createNodeDef(exportedSubgraph)
    registerLitegraphNode(nodeDef, subgraph, exportedSubgraph)
  }

  return {
    loadSubgraphs,
    registerNewSubgraph
  }
}
