import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearCompositorLayers,
  getCompositorBBoxes,
  getCompositorInputsFingerprint,
  getCompositorLayers
} from '@/composables/compositor/useCompositorLayers'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { ComfyApp } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'
import { toNodeId } from '@/types/nodeId'

import './imageCompositor'

const capturedExtensions = vi.hoisted<ComfyExtension[]>(() => [])

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (ext: ComfyExtension) => {
      capturedExtensions.push(ext)
    }
  })
}))

const nodeId = toNodeId(11)

function makeNode() {
  const savedValue = { layers: [] }
  const compositorWidget = {
    name: 'compositor',
    value: savedValue,
    callback: vi.fn()
  } as unknown as IBaseWidget
  const node = {
    id: nodeId,
    size: [100, 100],
    setSize: vi.fn(),
    constructor: { comfyClass: 'ImageCompositor' },
    widgets: [compositorWidget],
    widgets_values: [savedValue],
    graph: { setDirtyCanvas: vi.fn() }
  } as unknown as LGraphNode
  return { node, compositorWidget }
}

function createdNode() {
  const made = makeNode()
  const ext = capturedExtensions.find((e) => e.name === 'Comfy.ImageCompositor')
  expect(ext).toBeDefined()
  ext!.nodeCreated!(made.node, {} as ComfyApp)
  return made
}

describe('ImageCompositor extension', () => {
  beforeEach(() => {
    clearCompositorLayers(nodeId)
  })

  it('caches executed layers together with the inputs fingerprint', () => {
    const { node } = createdNode()

    node.onExecuted?.({
      compositor_layers: [
        { filename: 'a.png', subfolder: 'sub', type: 'temp' },
        { filename: 'b.png' }
      ],
      compositor_inputs: ['hash-a', 'hash-b']
    })

    expect(getCompositorLayers(nodeId)).toEqual([
      { filename: 'a.png', subfolder: 'sub', type: 'temp' },
      { filename: 'b.png', subfolder: '', type: 'temp' }
    ])
    expect(getCompositorInputsFingerprint(nodeId)).toEqual(['hash-a', 'hash-b'])
  })

  it('caches executed bboxes, keeping null entries index-aligned', () => {
    const { node } = createdNode()

    node.onExecuted?.({
      compositor_layers: [{ filename: 'a.png' }, { filename: 'b.png' }],
      compositor_inputs: ['hash-a', 'hash-b'],
      compositor_bboxes: [
        { x: 10, y: 20, width: 30, height: 40, name: 'Subject' },
        null
      ]
    })

    expect(getCompositorBBoxes(nodeId)).toEqual([
      { x: 10, y: 20, width: 30, height: 40, name: 'Subject' },
      null
    ])
  })

  it('leaves the bbox cache empty when the output has none', () => {
    const { node } = createdNode()

    node.onExecuted?.({
      compositor_layers: [{ filename: 'a.png' }],
      compositor_inputs: ['hash-a']
    })

    expect(getCompositorBBoxes(nodeId)).toBeUndefined()
  })

  it('resets the compositor widget when the state is stale', () => {
    const { node, compositorWidget } = createdNode()

    node.onExecuted?.({
      compositor_layers: [{ filename: 'a.png' }],
      compositor_inputs: ['hash-a'],
      compositor_state_stale: [true]
    })

    expect(compositorWidget.value).toEqual({})
    expect(compositorWidget.callback).toHaveBeenCalledWith({})
    expect(node.widgets_values).toEqual([{}])
    expect(node.graph?.setDirtyCanvas).toHaveBeenCalled()
  })

  it('keeps the widget untouched when the state is not stale', () => {
    const { node, compositorWidget } = createdNode()

    node.onExecuted?.({
      compositor_layers: [{ filename: 'a.png' }],
      compositor_inputs: ['hash-a']
    })

    expect(compositorWidget.value).toEqual({ layers: [] })
  })

  it('clears the cache when the node is removed', () => {
    const { node } = createdNode()
    node.onExecuted?.({
      compositor_layers: [{ filename: 'a.png' }],
      compositor_inputs: ['hash-a']
    })

    node.onRemoved?.()

    expect(getCompositorLayers(nodeId)).toBeUndefined()
    expect(getCompositorInputsFingerprint(nodeId)).toBeUndefined()
  })
})
