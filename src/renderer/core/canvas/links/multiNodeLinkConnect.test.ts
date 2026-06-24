import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ToInputRenderLink } from '@/lib/litegraph/src/canvas/ToInputRenderLink'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

vi.mock('@/utils/litegraphUtil', () => ({
  createNode: vi.fn(),
  isLGraphNode: (item: unknown) => item instanceof LGraphNode
}))

import { createNode } from '@/utils/litegraphUtil'

import {
  collectFanInputs,
  collectFanOutputs,
  connectImageBatchToCreatedNode,
  connectImagesToDynamicInput,
  createBatchImagesNode,
  toImageBatchSources
} from './multiNodeLinkConnect'

function addImageSource(graph: LGraph): LGraphNode {
  const node = new LGraphNode('LoadImage')
  node.addOutput('IMAGE', 'IMAGE')
  graph.add(node)
  return node
}

function addImageTarget(graph: LGraph): LGraphNode {
  const node = new LGraphNode('Target')
  node.addInput('image', 'IMAGE')
  graph.add(node)
  return node
}

function addAutogrowImageNode(graph: LGraph, slotCount = 3): LGraphNode {
  const node = new LGraphNode('BatchImagesNode')
  node.comfyDynamic = { autogrow: { images: {} } }
  for (let i = 0; i < slotCount; i++) {
    node.addInput(`images.${i}`, 'IMAGE')
  }
  graph.add(node)
  return node
}

describe('collectFanOutputs', () => {
  it('returns the grabbed source first, then matching selected nodes', () => {
    const graph = new LGraph()
    const grabbed = addImageSource(graph)
    const other = addImageSource(graph)

    const sources = collectFanOutputs(grabbed, 0, [grabbed, other])

    expect(sources).toEqual([
      { node: grabbed, outputIndex: 0 },
      { node: other, outputIndex: 0 }
    ])
  })

  it('falls back to the first type-compatible output when the index differs', () => {
    const graph = new LGraph()
    const grabbed = addImageSource(graph)

    const other = new LGraphNode('Mixed')
    other.addOutput('MASK', 'MASK')
    other.addOutput('IMAGE', 'IMAGE')
    graph.add(other)

    const sources = collectFanOutputs(grabbed, 0, [grabbed, other])

    expect(sources).toEqual([
      { node: grabbed, outputIndex: 0 },
      { node: other, outputIndex: 1 }
    ])
  })

  it('skips selected nodes without a type-compatible output', () => {
    const graph = new LGraph()
    const grabbed = addImageSource(graph)

    const incompatible = new LGraphNode('Latent')
    incompatible.addOutput('LATENT', 'LATENT')
    graph.add(incompatible)

    const sources = collectFanOutputs(grabbed, 0, [grabbed, incompatible])

    expect(sources).toEqual([{ node: grabbed, outputIndex: 0 }])
  })
})

describe('toImageBatchSources', () => {
  it('keeps LGraphNode candidates and drops non-node origins', () => {
    const graph = new LGraph()
    const node = addImageSource(graph)

    const sources = toImageBatchSources([
      { node, fromSlotIndex: 0 },
      { node: { id: 'io' }, fromSlotIndex: 2 }
    ])

    expect(sources).toEqual([{ node, outputIndex: 0 }])
  })
})

describe('collectFanInputs', () => {
  it('returns the grabbed input first, then matching selected nodes', () => {
    const graph = new LGraph()
    const grabbed = addImageTarget(graph)
    const other = addImageTarget(graph)

    const sources = collectFanInputs(grabbed, 0, [grabbed, other])

    expect(sources).toEqual([
      { node: grabbed, inputIndex: 0 },
      { node: other, inputIndex: 0 }
    ])
  })

  it('falls back to the first type-compatible input when the index differs', () => {
    const graph = new LGraph()
    const grabbed = addImageTarget(graph)

    const other = new LGraphNode('Mixed')
    other.addInput('mask', 'MASK')
    other.addInput('image', 'IMAGE')
    graph.add(other)

    const sources = collectFanInputs(grabbed, 0, [grabbed, other])

    expect(sources).toEqual([
      { node: grabbed, inputIndex: 0 },
      { node: other, inputIndex: 1 }
    ])
  })

  it('skips selected nodes without a type-compatible input', () => {
    const graph = new LGraph()
    const grabbed = addImageTarget(graph)

    const incompatible = new LGraphNode('Latent')
    incompatible.addInput('latent', 'LATENT')
    graph.add(incompatible)

    const sources = collectFanInputs(grabbed, 0, [grabbed, incompatible])

    expect(sources).toEqual([{ node: grabbed, inputIndex: 0 }])
  })
})

describe('createBatchImagesNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wires every source into the batch node and connects it to the target input', async () => {
    const graph = new LGraph()
    const source1 = addImageSource(graph)
    const source2 = addImageSource(graph)
    source1.pos = [0, 0]
    source2.pos = [0, 300]

    const target = new LGraphNode('TargetNode')
    target.addInput('image', 'IMAGE')
    target.pos = [500, 200]
    graph.add(target)

    const batch = new LGraphNode('BatchImagesNode')
    batch.addInput('image_1', 'IMAGE')
    batch.addInput('image_2', 'IMAGE')
    batch.addOutput('IMAGE', 'IMAGE')
    graph.add(batch)
    vi.mocked(createNode).mockResolvedValue(batch)

    const setDirty = vi.fn()
    const canvas = { setDirty } as unknown as LGraphCanvas

    const result = await createBatchImagesNode(
      canvas,
      [
        { node: source1, outputIndex: 0 },
        { node: source2, outputIndex: 0 }
      ],
      target,
      0
    )

    expect(result).toBe(batch)
    expect(batch.inputs[0].link).not.toBeNull()
    expect(batch.inputs[1].link).not.toBeNull()
    expect(target.inputs[0].link).not.toBeNull()

    const targetLink = graph.links[target.inputs[0].link!]
    expect(targetLink.origin_id).toBe(batch.id)

    // Positioned to the right of the source nodes, aligned to the topmost.
    expect(batch.pos[0]).toBeGreaterThan(source1.pos[0] + source1.size[0])
    expect(batch.pos[0]).toBeGreaterThan(source2.pos[0] + source2.size[0])
    expect(batch.pos[1]).toBe(0)
    expect(setDirty).toHaveBeenCalledWith(true, true)
  })

  it('returns null when the batch node cannot be created', async () => {
    vi.mocked(createNode).mockResolvedValue(null)
    const target = new LGraphNode('TargetNode')

    const result = await createBatchImagesNode(
      fromPartial({ setDirty: vi.fn() }),
      [],
      target,
      0
    )

    expect(result).toBeNull()
  })
})

function fakeCanvas(
  renderLinks: Partial<ToInputRenderLink>[],
  connectingTo: 'input' | 'output'
): LGraphCanvas {
  return fromPartial({
    linkConnector: { renderLinks, state: { connectingTo } },
    setDirty: vi.fn()
  })
}

function imageOutputLink(node: LGraphNode): Partial<ToInputRenderLink> {
  return { toType: 'input', node, fromSlot: node.outputs[0], fromSlotIndex: 0 }
}

describe('connectImageBatchToCreatedNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes a multi-image fan-out through a batch node into the created node', async () => {
    const graph = new LGraph()
    const source1 = addImageSource(graph)
    const source2 = addImageSource(graph)
    const created = addImageTarget(graph)

    const batch = new LGraphNode('BatchImagesNode')
    batch.addInput('image_1', 'IMAGE')
    batch.addInput('image_2', 'IMAGE')
    batch.addOutput('IMAGE', 'IMAGE')
    graph.add(batch)
    vi.mocked(createNode).mockResolvedValue(batch)

    const canvas = fakeCanvas(
      [imageOutputLink(source1), imageOutputLink(source2)],
      'input'
    )

    expect(connectImageBatchToCreatedNode(canvas, created)).toBe(true)

    await vi.waitFor(() => expect(created.inputs[0].link).not.toBeNull())
    expect(graph.links[created.inputs[0].link!].origin_id).toBe(batch.id)
    expect(batch.inputs[0].link).not.toBeNull()
    expect(batch.inputs[1].link).not.toBeNull()
  })

  it('ignores a single dragged link', () => {
    const graph = new LGraph()
    const source = addImageSource(graph)
    const created = addImageTarget(graph)
    const canvas = fakeCanvas([imageOutputLink(source)], 'input')

    expect(connectImageBatchToCreatedNode(canvas, created)).toBe(false)
  })

  it('ignores reverse (output) drags', () => {
    const graph = new LGraph()
    const source1 = addImageSource(graph)
    const source2 = addImageSource(graph)
    const created = addImageTarget(graph)
    const canvas = fakeCanvas(
      [imageOutputLink(source1), imageOutputLink(source2)],
      'output'
    )

    expect(connectImageBatchToCreatedNode(canvas, created)).toBe(false)
  })

  it('connects directly to a dynamic input without creating a batch node', () => {
    const graph = new LGraph()
    const source1 = addImageSource(graph)
    const source2 = addImageSource(graph)
    const created = addAutogrowImageNode(graph)
    const canvas = fakeCanvas(
      [imageOutputLink(source1), imageOutputLink(source2)],
      'input'
    )

    expect(connectImageBatchToCreatedNode(canvas, created)).toBe(true)
    expect(createNode).not.toHaveBeenCalled()
    expect(graph.links[created.inputs[0].link!].origin_id).toBe(source1.id)
    expect(graph.links[created.inputs[1].link!].origin_id).toBe(source2.id)
  })
})

describe('connectImagesToDynamicInput', () => {
  it('fills successive autogrow group slots from the sources', () => {
    const graph = new LGraph()
    const source1 = addImageSource(graph)
    const source2 = addImageSource(graph)
    const node = addAutogrowImageNode(graph)

    const handled = connectImagesToDynamicInput(node, node.inputs[0], [
      { node: source1, outputIndex: 0 },
      { node: source2, outputIndex: 0 }
    ])

    expect(handled).toBe(true)
    expect(graph.links[node.inputs[0].link!].origin_id).toBe(source1.id)
    expect(graph.links[node.inputs[1].link!].origin_id).toBe(source2.id)
  })

  it('returns false for a node without a dynamic input', () => {
    const graph = new LGraph()
    const source = addImageSource(graph)
    const target = addImageTarget(graph)

    expect(
      connectImagesToDynamicInput(target, target.inputs[0], [
        { node: source, outputIndex: 0 }
      ])
    ).toBe(false)
    expect(target.inputs[0].link).toBeNull()
  })

  it('returns false when the dynamic group has no free slot', () => {
    const graph = new LGraph()
    const occupier = addImageSource(graph)
    const newSource = addImageSource(graph)
    const node = addAutogrowImageNode(graph, 1)
    occupier.connect(0, node, 0)

    expect(
      connectImagesToDynamicInput(node, node.inputs[0], [
        { node: newSource, outputIndex: 0 }
      ])
    ).toBe(false)
  })

  it('does not report success when the connection is rejected', () => {
    const graph = new LGraph()
    const node = addAutogrowImageNode(graph)

    const maskSource = new LGraphNode('Mask')
    maskSource.addOutput('MASK', 'MASK')
    graph.add(maskSource)

    const handled = connectImagesToDynamicInput(node, node.inputs[0], [
      { node: maskSource, outputIndex: 0 }
    ])

    expect(handled).toBe(false)
    expect(node.inputs[0].link).toBeNull()
  })
})
