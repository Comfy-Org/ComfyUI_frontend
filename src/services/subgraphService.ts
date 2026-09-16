import type {
  ExportedSubgraph,
  ExportedSubgraphInstance,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { normalizeSubgraphDefinitionIds } from '@/lib/litegraph/src/subgraph/subgraphDeduplication'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
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
      description: exportedSubgraph.description || `Subgraph node for ${name}`,
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

    const normalized = normalizeSubgraphDefinitionIds(
      subgraphs,
      graphData.nodes
    )
    graphData.definitions!.subgraphs = normalized.subgraphs
    if (normalized.rootNodes) graphData.nodes = normalized.rootNodes
    // Assertion: overriding Zod schema
    const exportedSubgraphs = normalized.subgraphs as ExportedSubgraph[]
    const missingSubgraphs = exportedSubgraphs.filter(
      ({ id }) => !comfyApp.rootGraph.subgraphs.has(id)
    )
    const createdSubgraphs =
      comfyApp.rootGraph.createSubgraphs(missingSubgraphs)
    const loadedSubgraphs = new Map(comfyApp.rootGraph.subgraphs)
    for (const [index, data] of missingSubgraphs.entries()) {
      loadedSubgraphs.set(data.id, createdSubgraphs[index])
    }

    for (const subgraphData of exportedSubgraphs) {
      const subgraph = loadedSubgraphs.get(subgraphData.id)
      if (!subgraph) continue

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
