import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearCompositorLayers,
  getCompositorBBoxes,
  getCompositorCanvas,
  getCompositorInputsFingerprint,
  getCompositorLayers
} from '@/renderer/extensions/compositor/composables/useCompositorLayers'
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
const cacheNode = { id: nodeId } as unknown as LGraphNode

function makeNode() {
  const savedValue = { layers: [] }
  const compositorWidget = {
    name: 'compositor',
    value: savedValue,
    callback: vi.fn()
  } as unknown as IBaseWidget
  const priorOnExecuted = vi.fn()
  const priorOnRemoved = vi.fn()
  const node = {
    id: nodeId,
    size: [100, 100],
    setSize: vi.fn(),
    onExecuted: priorOnExecuted,
    onRemoved: priorOnRemoved,
    constructor: { comfyClass: 'ImageCompositor' },
    widgets: [compositorWidget],
    widgets_values: [savedValue],
    graph: { setDirtyCanvas: vi.fn() }
  } as unknown as LGraphNode
  return { node, compositorWidget, priorOnExecuted, priorOnRemoved }
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
    clearCompositorLayers(cacheNode)
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

    expect(getCompositorLayers(node)).toEqual([
      { filename: 'a.png', subfolder: 'sub', type: 'temp' },
      { filename: 'b.png', subfolder: '', type: 'temp' }
    ])
    expect(getCompositorInputsFingerprint(node)).toEqual(['hash-a', 'hash-b'])
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

    expect(getCompositorBBoxes(node)).toEqual([
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

    expect(getCompositorBBoxes(node)).toBeUndefined()
  })

  it('caches the document canvas reported by the backend', () => {
    const { node } = createdNode()

    node.onExecuted?.({
      compositor_layers: [{ filename: 'a.png' }],
      compositor_inputs: ['hash-a'],
      compositor_canvas: [{ w: 1280, h: 1280 }]
    })

    expect(getCompositorCanvas(node)).toEqual({ w: 1280, h: 1280 })
  })

  it('leaves the canvas cache empty when the output has none', () => {
    const { node } = createdNode()

    node.onExecuted?.({
      compositor_layers: [{ filename: 'a.png' }],
      compositor_inputs: ['hash-a']
    })

    expect(getCompositorCanvas(node)).toBeUndefined()
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

    expect(getCompositorLayers(node)).toBeUndefined()
    expect(getCompositorInputsFingerprint(node)).toBeUndefined()
  })

  it('chains through the prior onExecuted and onRemoved handlers', () => {
    const { node, priorOnExecuted, priorOnRemoved } = createdNode()
    const output = { compositor_layers: [{ filename: 'a.png' }] }

    node.onExecuted?.(output)
    node.onRemoved?.()

    expect(priorOnExecuted).toHaveBeenCalledWith(output)
    expect(priorOnRemoved).toHaveBeenCalledTimes(1)
  })

  it('keeps bboxes aligned when invalid layer entries are dropped', () => {
    const { node } = createdNode()

    node.onExecuted?.({
      compositor_layers: [{ filename: 'a.png' }, {}, { filename: 'c.png' }],
      compositor_bboxes: [
        { x: 0, y: 0, width: 10, height: 10, name: 'a' },
        { x: 5, y: 5, width: 10, height: 10, name: 'dropped' },
        { x: 9, y: 9, width: 10, height: 10, name: 'c' }
      ]
    })

    expect(getCompositorLayers(node)).toHaveLength(2)
    expect(getCompositorBBoxes(node)?.map((bbox) => bbox?.name)).toEqual([
      'a',
      'c'
    ])
  })
})
