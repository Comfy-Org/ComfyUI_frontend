import { assert } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

interface SlotNames {
  readonly inputs?: readonly string[]
  readonly outputs?: readonly string[]
}

/** Adds a node the prompt sends to the backend, with a `STRING` slot for each name. */
export function addBackendNode(
  graph: LGraph,
  comfyClass: string,
  { inputs = [], outputs = [] }: SlotNames = {}
): LGraphNode {
  const node = new LGraphNode(comfyClass)
  node.type = comfyClass
  node.comfyClass = comfyClass
  for (const name of inputs) node.addInput(name, 'STRING')
  for (const name of outputs) node.addOutput(name, 'STRING')
  graph.add(node)
  return node
}

/** Adds a node of a registered type. */
export function addNodeOfType(graph: LGraph, type: string): LGraphNode {
  const node = LiteGraph.createNode(type)
  assert(node, `${type} is not registered`)
  graph.add(node)
  return node
}
