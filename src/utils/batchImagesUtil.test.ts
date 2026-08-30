import { describe, expect, it } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import {
  BATCH_IMAGES_NODE_TYPE,
  canAppendToBatch,
  canCreateBatch,
  resolveBatchImagesSelection
} from '@/utils/batchImagesUtil'

let nextNodeId = 0
const uniqueId = () => toNodeId(++nextNodeId)

const imageNode = (overrides: Record<string, unknown> = {}) =>
  createMockLGraphNode({
    id: uniqueId(),
    type: 'LoadImage',
    outputs: [{ name: 'IMAGE', type: 'IMAGE' }],
    ...overrides
  })

const batchNode = (feeding: LGraphNode[] = []) =>
  createMockLGraphNode({
    id: uniqueId(),
    type: BATCH_IMAGES_NODE_TYPE,
    outputs: [{ name: 'IMAGE', type: 'IMAGE' }],
    inputs: feeding.map(() => ({ name: 'image', type: 'IMAGE' })),
    graph: {} as LGraphNode['graph'],
    getInputNode: (slot: number) => feeding[slot] ?? null
  })

describe('resolveBatchImagesSelection', () => {
  it('orders sources top-to-bottom then left-to-right', () => {
    const bottom = imageNode({ pos: [0, 100] })
    const topRight = imageNode({ pos: [50, 0] })
    const topLeft = imageNode({ pos: [0, 0] })

    const { target, sources } = resolveBatchImagesSelection([
      bottom,
      topRight,
      topLeft
    ])

    expect(target).toBeUndefined()
    expect(sources).toEqual([topLeft, topRight, bottom])
  })

  it('ignores nodes without an IMAGE output', () => {
    const image = imageNode()
    const latent = createMockLGraphNode({
      id: uniqueId(),
      outputs: [{ name: 'LATENT', type: 'LATENT' }]
    })

    expect(resolveBatchImagesSelection([image, latent]).sources).toEqual([
      image
    ])
  })

  it('appends into the batch node named by the selection', () => {
    const batch = batchNode()
    const image = imageNode()

    const selection = resolveBatchImagesSelection([batch, image])

    expect(selection.target).toBe(batch)
    expect(selection.sources).toEqual([image])
    expect(canAppendToBatch(selection)).toBe(true)
    expect(canCreateBatch(selection)).toBe(false)
  })

  it('excludes sources already feeding the batch node', () => {
    const connected = imageNode()
    const fresh = imageNode()
    const batch = batchNode([connected])

    const selection = resolveBatchImagesSelection([batch, connected, fresh])

    expect(selection.sources).toEqual([fresh])
  })

  it('cannot append when every selected source already feeds the batch node', () => {
    const connected = imageNode()
    const batch = batchNode([connected])

    const selection = resolveBatchImagesSelection([batch, connected])

    expect(selection.sources).toEqual([])
    expect(canAppendToBatch(selection)).toBe(false)
  })

  it('creates a new batch when the selection names more than one batch node', () => {
    const selection = resolveBatchImagesSelection([
      batchNode(),
      batchNode(),
      imageNode()
    ])

    expect(selection.target).toBeUndefined()
    expect(canCreateBatch(selection)).toBe(true)
  })

  it('cannot create a batch from a single image node', () => {
    expect(canCreateBatch(resolveBatchImagesSelection([imageNode()]))).toBe(
      false
    )
  })
})
