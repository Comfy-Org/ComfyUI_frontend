import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

describe('reconcileNodeErrorFlags (via lastNodeErrors watcher)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function setupGraphWithStore() {
    const graph = new LGraph()
    const nodeA = new LGraphNode('KSampler')
    nodeA.addInput('model', 'MODEL')
    nodeA.addInput('steps', 'INT')
    graph.add(nodeA)

    const nodeB = new LGraphNode('LoadCheckpoint')
    nodeB.addInput('ckpt_name', 'STRING')
    graph.add(nodeB)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(true)

    const settingStore = useSettingStore()
    settingStore.settingValues['Comfy.RightSidePanel.ShowErrorsTab'] = true

    const store = useExecutionErrorStore()
    return { graph, nodeA, nodeB, store }
  }

  it('sets has_errors on nodes referenced in lastNodeErrors', async () => {
    const { nodeA, nodeB, store } = setupGraphWithStore()

    store.recordNodeErrors({
      [String(nodeA.id)]: {
        errors: [
          {
            type: 'value_bigger_than_max',
            message: 'Too big',
            details: '',
            extra_info: { input_name: 'steps' }
          }
        ],
        dependent_outputs: [],
        class_type: 'KSampler'
      }
    })
    await nextTick()

    expect(nodeA.has_errors).toBe(true)
    expect(nodeB.has_errors).toBeFalsy()
  })

  it('sets slot hasErrors for inputs matching error input_name', async () => {
    const { nodeA, store } = setupGraphWithStore()

    store.recordNodeErrors({
      [String(nodeA.id)]: {
        errors: [
          {
            type: 'required_input_missing',
            message: 'Missing',
            details: '',
            extra_info: { input_name: 'model' }
          }
        ],
        dependent_outputs: [],
        class_type: 'KSampler'
      }
    })
    await nextTick()

    expect(nodeA.inputs[0].hasErrors).toBe(true)
    expect(nodeA.inputs[1].hasErrors).toBe(false)
  })

  it('clears has_errors and slot hasErrors when errors are removed', async () => {
    const { nodeA, store } = setupGraphWithStore()

    store.recordNodeErrors({
      [String(nodeA.id)]: {
        errors: [
          {
            type: 'value_bigger_than_max',
            message: 'Too big',
            details: '',
            extra_info: { input_name: 'steps' }
          }
        ],
        dependent_outputs: [],
        class_type: 'KSampler'
      }
    })
    await nextTick()
    expect(nodeA.has_errors).toBe(true)
    expect(nodeA.inputs[1].hasErrors).toBe(true)

    store.recordNodeErrors(null)
    await nextTick()

    expect(nodeA.has_errors).toBeFalsy()
    expect(nodeA.inputs[1].hasErrors).toBe(false)
  })

  it('propagates has_errors to parent subgraph node', async () => {
    const subgraph = createTestSubgraph()
    const interiorNode = new LGraphNode('InnerNode')
    interiorNode.addInput('value', 'INT')
    subgraph.add(interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 50 })
    const graph = subgraphNode.graph as LGraph
    graph.add(subgraphNode)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(true)

    const store = useExecutionErrorStore()

    const interiorExecId = `${subgraphNode.id}:${interiorNode.id}`
    store.recordNodeErrors({
      [interiorExecId]: {
        errors: [
          {
            type: 'required_input_missing',
            message: 'Missing',
            details: '',
            extra_info: { input_name: 'value' }
          }
        ],
        dependent_outputs: [],
        class_type: 'InnerNode'
      }
    })
    await nextTick()

    expect(interiorNode.has_errors).toBe(true)
    expect(interiorNode.inputs[0].hasErrors).toBe(true)
    expect(subgraphNode.has_errors).toBe(true)
  })

  it('sets has_errors on nodes with missing models', async () => {
    const { nodeA, nodeB } = setupGraphWithStore()
    const missingModelStore = useMissingModelStore()

    missingModelStore.setMissingModels([
      {
        nodeId: String(nodeA.id),
        nodeType: 'CheckpointLoader',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'missing.safetensors',
        isMissing: true
      }
    ])
    await nextTick()

    expect(nodeA.has_errors).toBe(true)
    expect(nodeB.has_errors).toBeFalsy()
  })

  it('clears has_errors when missing models are removed', async () => {
    const { nodeA } = setupGraphWithStore()
    const missingModelStore = useMissingModelStore()

    missingModelStore.setMissingModels([
      {
        nodeId: String(nodeA.id),
        nodeType: 'CheckpointLoader',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'missing.safetensors',
        isMissing: true
      }
    ])
    await nextTick()
    expect(nodeA.has_errors).toBe(true)

    missingModelStore.clearMissingModels()
    await nextTick()
    expect(nodeA.has_errors).toBeFalsy()
  })

  it('flags parent subgraph node when interior node has missing model', async () => {
    const subgraph = createTestSubgraph()
    const interiorNode = new LGraphNode('CheckpointLoader')
    subgraph.add(interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 50 })
    const graph = subgraphNode.graph as LGraph
    graph.add(subgraphNode)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(true)

    const settingStore = useSettingStore()
    settingStore.settingValues['Comfy.RightSidePanel.ShowErrorsTab'] = true

    useExecutionErrorStore()
    const missingModelStore = useMissingModelStore()

    missingModelStore.setMissingModels([
      {
        nodeId: `${subgraphNode.id}:${interiorNode.id}`,
        nodeType: 'CheckpointLoader',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'missing.safetensors',
        isMissing: true
      }
    ])
    await nextTick()

    expect(interiorNode.has_errors).toBe(true)
    expect(subgraphNode.has_errors).toBe(true)
  })
})
