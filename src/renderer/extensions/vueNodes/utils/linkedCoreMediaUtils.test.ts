import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createMockLGraphNode,
  createMockNodeInputSlot
} from '@/utils/__tests__/litegraphTestUtils'

import {
  shouldHideLinkedCoreLoadAudioPlayer,
  shouldHideLinkedCoreMediaInputActions,
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

describe('linked core media loader matching', () => {
  it.for([
    { nodeClass: 'LoadImage', selector: 'image' },
    { nodeClass: 'LoadImageMask', selector: 'image' },
    { nodeClass: 'LoadImageOutput', selector: 'image' },
    { nodeClass: 'LoadVideo', selector: 'file' }
  ] as const)(
    'matches core $nodeClass by its exact selector',
    ({ nodeClass, selector }) => {
      const node = mediaNode({ linkedInputName: selector, nodeClass })

      expect(shouldHideLinkedCoreMediaInputActions(node)).toBe(true)
    }
  )

  it('matches core LoadAudio by its exact selector', () => {
    const node = mediaNode({
      linkedInputName: 'audio',
      nodeClass: 'LoadAudio'
    })

    expect(shouldHideLinkedCoreLoadAudioPlayer(node)).toBe(true)
  })

  it('excludes a custom node with a core class name', () => {
    const node = mediaNode({
      isCoreNode: false,
      linkedInputName: 'image',
      nodeClass: 'LoadImage'
    })

    expect(shouldHideLinkedCoreMediaInputActions(node)).toBe(false)
    expect(shouldHideLinkedCoreLoadAudioPlayer(node)).toBe(false)
  })

  it.for([
    { nodeClass: 'PreviewImage', selector: 'image' },
    { nodeClass: 'SaveImage', selector: 'image' },
    { nodeClass: 'Load3D', selector: 'model_file' },
    { nodeClass: 'Load3DAdvanced', selector: 'model_file' },
    { nodeClass: 'PreviewAudio', selector: 'audio' },
    { nodeClass: 'SaveAudio', selector: 'audio' },
    { nodeClass: 'RecordAudio', selector: 'audio' }
  ])(
    'excludes the other core node class $nodeClass',
    ({ nodeClass, selector }) => {
      const node = mediaNode({ linkedInputName: selector, nodeClass })

      expect(shouldHideLinkedCoreMediaInputActions(node)).toBe(false)
      expect(shouldHideLinkedCoreLoadAudioPlayer(node)).toBe(false)
    }
  )

  it('ignores an unrelated linked widget', () => {
    const node = mediaNode({ linkedInputName: 'mask', nodeClass: 'LoadImage' })

    expect(shouldHideLinkedCoreMediaInputActions(node)).toBe(false)
    expect(shouldHideLinkedCoreLoadAudioPlayer(node)).toBe(false)
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

describe(shouldHideLinkedCoreMediaInputActions, () => {
  it.for([
    { nodeClass: 'LoadImage', selector: 'image' },
    { nodeClass: 'LoadImageMask', selector: 'image' },
    { nodeClass: 'LoadImageOutput', selector: 'image' },
    { nodeClass: 'LoadVideo', selector: 'file' }
  ] as const)(
    'hides input actions for a linked core $nodeClass selector',
    ({ nodeClass, selector }) => {
      const node = mediaNode({ linkedInputName: selector, nodeClass })

      expect(shouldHideLinkedCoreMediaInputActions(node)).toBe(true)
    }
  )

  it('does not hide image actions for a linked LoadAudio selector', () => {
    const node = mediaNode({
      linkedInputName: 'audio',
      nodeClass: 'LoadAudio'
    })

    expect(shouldHideLinkedCoreMediaInputActions(node)).toBe(false)
  })
})

describe(shouldHideLinkedCoreMediaInputPreview, () => {
  it.for([
    { nodeClass: 'LoadImage', selector: 'image' },
    { nodeClass: 'LoadImageMask', selector: 'image' },
    { nodeClass: 'LoadImageOutput', selector: 'image' },
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

  it('keeps the preview for a linked non-selector widget', () => {
    const node = mediaNode({
      linkedInputName: 'seed',
      nodeClass: 'LoadImage'
    })

    expect(
      shouldHideLinkedCoreMediaInputPreview(node, {
        images: [{ type: 'input' }]
      })
    ).toBe(false)
  })
})
