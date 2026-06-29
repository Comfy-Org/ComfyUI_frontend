import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { LGraphBadge } from '@/lib/litegraph/src/litegraph'
import type { NodeDataStateInit } from '@/types/nodeData'
import { toNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

import { useNodeDataStore } from './nodeDataStore'

function nodeData(
  title: string,
  extra: Partial<NodeDataStateInit> = {}
): NodeDataStateInit {
  return {
    executing: false,
    mode: 0,
    selected: false,
    title,
    type: 'TestNode',
    ...extra
  }
}
function inputSlot(name = 'input'): INodeInputSlot {
  return { name, type: 'STRING', link: null, boundingRect: [0, 0, 0, 0] }
}

function outputSlot(name = 'output'): INodeOutputSlot {
  return { name, type: 'STRING', links: [], boundingRect: [0, 0, 0, 0] }
}

describe('useNodeDataStore', () => {
  const graphA = 'graph-a' as UUID
  const graphB = 'graph-b' as UUID
  const nodeA = toNodeId('node-1')

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('getNodeData returns undefined for unregistered nodes', () => {
    const store = useNodeDataStore()
    expect(store.getNodeData(graphA, nodeA)).toBeUndefined()
  })

  it('registers minimal node data', () => {
    const store = useNodeDataStore()
    const registered = store.registerNodeData(graphA, nodeA, nodeData('First'))

    expect(registered.id).toBe(nodeA)
    expect(registered.title).toBe('First')
    expect(registered.type).toBe('TestNode')
    expect(registered.executing).toBe(false)
  })

  it('registerNodeData is idempotent and preserves existing state', () => {
    const store = useNodeDataStore()
    const first = store.registerNodeData(graphA, nodeA, nodeData('First'))
    first.title = 'Changed'

    const second = store.registerNodeData(graphA, nodeA, nodeData('Second'))

    expect(second).toBe(first)
    expect(second.title).toBe('Changed')
  })

  it('patches existing node data and reports missing nodes', () => {
    const store = useNodeDataStore()
    store.registerNodeData(graphA, nodeA, nodeData('First'))

    expect(
      store.patchNodeData(graphA, nodeA, {
        title: 'Patched',
        flags: { collapsed: true }
      })
    ).toBe(true)
    expect(store.getNodeData(graphA, nodeA)?.title).toBe('Patched')
    expect(store.getNodeData(graphA, nodeA)?.flags?.collapsed).toBe(true)
    expect(
      store.patchNodeData(graphA, toNodeId('missing'), { title: 'Missing' })
    ).toBe(false)
  })

  it('patches node data from LiteGraph property names', () => {
    const store = useNodeDataStore()
    const badge = new LGraphBadge({ text: 'badge' })

    store.registerNodeData(graphA, nodeA, nodeData('First'))

    expect(store.patchNodeProperty(graphA, nodeA, 'title', 'Renamed')).toBe(
      true
    )
    expect(store.patchNodeProperty(graphA, nodeA, 'has_errors', 1)).toBe(true)
    expect(store.patchNodeProperty(graphA, nodeA, 'mode', 4)).toBe(true)
    expect(store.patchNodeProperty(graphA, nodeA, 'color', '#111111')).toBe(
      true
    )
    expect(store.patchNodeProperty(graphA, nodeA, 'bgcolor', '#222222')).toBe(
      true
    )
    expect(store.patchNodeProperty(graphA, nodeA, 'shape', 2)).toBe(true)
    expect(store.patchNodeProperty(graphA, nodeA, 'showAdvanced', true)).toBe(
      true
    )
    expect(store.patchNodeProperty(graphA, nodeA, 'badges', [badge])).toBe(true)

    expect(store.getNodeData(graphA, nodeA)).toMatchObject({
      title: 'Renamed',
      hasErrors: true,
      mode: 4,
      color: '#111111',
      bgcolor: '#222222',
      shape: 2,
      showAdvanced: true,
      badges: [badge]
    })
  })

  it('merges flag property patches with existing flags', () => {
    const store = useNodeDataStore()
    store.registerNodeData(
      graphA,
      nodeA,
      nodeData('First', { flags: { collapsed: false, ghost: true } })
    )

    expect(
      store.patchNodeProperty(graphA, nodeA, 'flags.collapsed', true)
    ).toBe(true)
    expect(store.patchNodeProperty(graphA, nodeA, 'flags.pinned', 1)).toBe(true)

    expect(store.getNodeData(graphA, nodeA)?.flags).toEqual({
      collapsed: true,
      ghost: true,
      pinned: true
    })
  })

  it('ignores unknown node properties without creating node data', () => {
    const store = useNodeDataStore()
    const missingNode = toNodeId('missing')
    store.registerNodeData(graphA, nodeA, nodeData('First'))

    expect(
      store.patchNodeProperty(graphA, nodeA, 'unknown.property', 'Ignored')
    ).toBe(false)
    expect(
      store.patchNodeProperty(graphA, missingNode, 'title', 'Missing')
    ).toBe(false)

    expect(store.getNodeData(graphA, nodeA)?.title).toBe('First')
    expect(store.getNodeData(graphA, missingNode)).toBeUndefined()
    expect(store.getGraphNodes(graphA)).toHaveLength(1)
  })

  it('deletes existing nodes and reports missing nodes', () => {
    const store = useNodeDataStore()
    store.registerNodeData(graphA, nodeA, nodeData('First'))

    expect(store.deleteNodeData(graphA, nodeA)).toBe(true)
    expect(store.getNodeData(graphA, nodeA)).toBeUndefined()
    expect(store.deleteNodeData(graphA, nodeA)).toBe(false)
  })

  it('returns registered nodes for a graph namespace', () => {
    const store = useNodeDataStore()
    const nodeB = toNodeId('node-2')

    expect(store.getGraphNodes(graphA)).toEqual([])

    store.registerNodeData(graphA, nodeA, nodeData('First'))
    store.registerNodeData(graphA, nodeB, nodeData('Second'))

    expect(store.getGraphNodes(graphA).map((node) => node.title)).toEqual([
      'First',
      'Second'
    ])
  })

  it('isolates the same NodeId in different graph namespaces', () => {
    const store = useNodeDataStore()
    store.registerNodeData(graphA, nodeA, nodeData('Graph A'))
    store.registerNodeData(graphB, nodeA, nodeData('Graph B'))

    expect(store.getNodeData(graphA, nodeA)?.title).toBe('Graph A')
    expect(store.getNodeData(graphB, nodeA)?.title).toBe('Graph B')
  })

  it('clearGraph only clears one graph namespace', () => {
    const store = useNodeDataStore()
    store.registerNodeData(graphA, nodeA, nodeData('Graph A'))
    store.registerNodeData(graphB, nodeA, nodeData('Graph B'))

    store.clearGraph(graphA)

    expect(store.getNodeData(graphA, nodeA)).toBeUndefined()
    expect(store.getNodeData(graphB, nodeA)?.title).toBe('Graph B')
  })

  it('copies init and patch arrays and objects', () => {
    const store = useNodeDataStore()
    const inputs = [inputSlot()]
    const widgets = [
      {
        name: 'seed',
        type: 'number',
        options: { hidden: false },
        slotMetadata: { index: 0, linked: false, type: 'INT' }
      }
    ]
    const flags = { collapsed: false }

    store.registerNodeData(
      graphA,
      nodeA,
      nodeData('First', { flags, inputs, widgets })
    )

    inputs.push(inputSlot('other'))
    widgets[0].options.hidden = true
    widgets[0].slotMetadata.linked = true
    flags.collapsed = true

    const registered = store.getNodeData(graphA, nodeA)
    expect(registered?.inputs).toHaveLength(1)
    expect(registered?.widgets?.[0]?.options?.hidden).toBe(false)
    expect(registered?.widgets?.[0]?.slotMetadata?.linked).toBe(false)
    expect(registered?.flags?.collapsed).toBe(false)

    const outputs = [outputSlot()]
    expect(store.patchNodeData(graphA, nodeA, { outputs })).toBe(true)
    outputs.push(outputSlot('other'))

    expect(store.getNodeData(graphA, nodeA)?.outputs).toHaveLength(1)
  })
})
