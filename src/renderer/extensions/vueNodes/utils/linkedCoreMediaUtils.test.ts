import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createMockLGraphNode,
  createMockNodeInputSlot
} from '@/utils/__tests__/litegraphTestUtils'

import {
  getLinkedCoreMediaLoaderClass,
  shouldHideLinkedCoreLoadAudioPlayer,
  shouldHideLinkedCoreMediaInputPreview
} from './linkedCoreMediaUtils'

interface MediaNodeOptions {
  isCoreNode?: boolean
  linkedInputName?: string
  nodeClass: string
}

function mediaNode({
  isCoreNode = true,
  linkedInputName,
  nodeClass
}: MediaNodeOptions): LGraphNode {
  const selectorWidget = linkedInputName
    ? { name: linkedInputName, options: {}, type: 'combo', y: 0 }
    : undefined
  const selectorInput = linkedInputName
    ? createMockNodeInputSlot({
        name: linkedInputName,
        widget: { name: linkedInputName }
      })
    : undefined

  return createMockLGraphNode({
    constructor: {
      comfyClass: nodeClass,
      nodeData: { isCoreNode }
    },
    getSlotFromWidget: (widget: unknown) =>
      widget === selectorWidget ? selectorInput : undefined,
    inputs: selectorInput ? [selectorInput] : [],
    isInputConnected: vi.fn(() => linkedInputName !== undefined),
    widgets: selectorWidget ? [selectorWidget] : []
  })
}

function linkedWidget(name: string) {
  return { name, slotMetadata: { index: 0, linked: true, type: 'STRING' } }
}

describe(getLinkedCoreMediaLoaderClass, () => {
  it.for([
    { nodeClass: 'LoadImage', selector: 'image' },
    { nodeClass: 'LoadVideo', selector: 'file' },
    { nodeClass: 'LoadAudio', selector: 'audio' }
  ] as const)(
    'matches core $nodeClass by its exact selector',
    ({ nodeClass, selector }) => {
      const node = mediaNode({ nodeClass })

      expect(
        getLinkedCoreMediaLoaderClass(node, [linkedWidget(selector)])
      ).toBe(nodeClass)
    }
  )

  it('excludes a custom node with a core class name', () => {
    const node = mediaNode({
      isCoreNode: false,
      linkedInputName: 'image',
      nodeClass: 'LoadImage'
    })

    expect(getLinkedCoreMediaLoaderClass(node)).toBeUndefined()
  })

  it.for([
    { nodeClass: 'PreviewImage', selector: 'image' },
    { nodeClass: 'SaveImage', selector: 'image' },
    { nodeClass: 'LoadImageMask', selector: 'image' },
    { nodeClass: 'LoadImageOutput', selector: 'image' },
    { nodeClass: 'PreviewAudio', selector: 'audio' },
    { nodeClass: 'SaveAudio', selector: 'audio' },
    { nodeClass: 'RecordAudio', selector: 'audio' }
  ])(
    'excludes the other core node class $nodeClass',
    ({ nodeClass, selector }) => {
      const node = mediaNode({ linkedInputName: selector, nodeClass })

      expect(getLinkedCoreMediaLoaderClass(node)).toBeUndefined()
    }
  )

  it('ignores an unrelated linked widget', () => {
    const node = mediaNode({ linkedInputName: 'mask', nodeClass: 'LoadImage' })

    expect(getLinkedCoreMediaLoaderClass(node)).toBeUndefined()
  })

  it('reads the live selector input and restores availability on disconnect', () => {
    const node = mediaNode({
      linkedInputName: 'audio',
      nodeClass: 'LoadAudio'
    })

    expect(shouldHideLinkedCoreLoadAudioPlayer(node)).toBe(true)
    expect(node.isInputConnected).toHaveBeenCalledWith(0)

    vi.mocked(node.isInputConnected).mockReturnValue(false)

    expect(shouldHideLinkedCoreLoadAudioPlayer(node)).toBe(false)
  })
})

describe(shouldHideLinkedCoreMediaInputPreview, () => {
  it.for([
    { nodeClass: 'LoadImage', selector: 'image' },
    { nodeClass: 'LoadVideo', selector: 'file' }
  ] as const)(
    'hides only an input preview on core $nodeClass',
    ({ nodeClass, selector }) => {
      const node = mediaNode({ linkedInputName: selector, nodeClass })

      expect(
        shouldHideLinkedCoreMediaInputPreview(node, {
          images: [{ type: 'input' }]
        })
      ).toBe(true)
      expect(
        shouldHideLinkedCoreMediaInputPreview(node, {
          images: [{ type: 'output' }]
        })
      ).toBe(false)
      expect(
        shouldHideLinkedCoreMediaInputPreview(node, {
          images: [{ type: 'input' }, { type: 'output' }]
        })
      ).toBe(false)
      expect(shouldHideLinkedCoreMediaInputPreview(node, { images: [] })).toBe(
        false
      )
    }
  )
})
