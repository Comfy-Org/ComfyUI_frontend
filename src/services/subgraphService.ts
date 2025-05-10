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
  /** @todo Move to store */
  const subgraphs: Subgraph[] = []

  /** Loads a single subgraph definition and registers it with the node def store */
  const deserialiseSubgraph = (
    subgraph: Subgraph,
    exportedSubgraph: ExportedSubgraph
  ) => {
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

    useNodeDefStore().addNodeDef(nodeDef)

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

  /** Loads all exported subgraph definitionsfrom workflow */
  const loadSubgraphs = (graphData: ComfyWorkflowJSON) => {
    if (!graphData.definitions?.subgraphs) return

    for (const subgraphData of graphData.definitions.subgraphs) {
      const subgraph =
        subgraphs.find((x) => x.id === subgraphData.id) ??
        comfyApp.graph.createSubgraph(subgraphData as ExportedSubgraph)

      // @ts-expect-error Zod
      deserialiseSubgraph(subgraph, subgraphData)
    }
  }

  /** Registers a new subgraph (e.g. user converted from nodes) */
  const registerNewSubgraph = (subgraph: Subgraph) => {
    subgraphs.push(subgraph)

    deserialiseSubgraph(subgraph, subgraph.asSerialisable())
  }

  return {
    loadSubgraphs,
    registerNewSubgraph
  }
}
