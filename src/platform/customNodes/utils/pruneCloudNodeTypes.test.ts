import { afterEach, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import { pruneCloudNodeTypes } from './pruneCloudNodeTypes'

const definition = (name: string, python_module: string): ComfyNodeDef => ({
  name,
  display_name: name,
  description: '',
  python_module,
  category: 'test',
  input: {},
  output: ['STRING'],
  output_node: false
})

afterEach(() => {
  for (const name of ['PinnedCloudTest', 'OtherTest', 'RetainedCloudTest']) {
    if (LiteGraph.registered_node_types[name])
      LiteGraph.unregisterNodeType(name)
  }
})

it('removes unpinned Cloud types without removing graph instances or other extensions', () => {
  class Node extends LGraphNode {}
  for (const name of ['PinnedCloudTest', 'OtherTest', 'RetainedCloudTest']) {
    LiteGraph.registerNodeType(name, class extends Node {})
  }
  const graph = new LGraph()
  const node = LiteGraph.createNode('PinnedCloudTest')
  if (!node) throw new Error('Expected registered node')
  graph.add(node)
  const previous = {
    PinnedCloudTest: definition(
      'PinnedCloudTest',
      'custom_nodes.cloud_registry.old'
    ),
    OtherTest: definition('OtherTest', 'custom_nodes.other'),
    RetainedCloudTest: definition(
      'RetainedCloudTest',
      'custom_nodes.cloud_registry.retained'
    )
  }
  pruneCloudNodeTypes(Object.values(previous), {
    RetainedCloudTest: previous.RetainedCloudTest
  })
  expect(LiteGraph.createNode('PinnedCloudTest')).toBeNull()
  expect(LiteGraph.createNode('OtherTest')).not.toBeNull()
  expect(LiteGraph.createNode('RetainedCloudTest')).not.toBeNull()
  expect(graph.getNodeById(node.id)).toBe(node)
})
