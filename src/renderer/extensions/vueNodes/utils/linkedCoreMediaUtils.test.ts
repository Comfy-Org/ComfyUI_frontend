import { describe, expect, it } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeExecutionOutput } from '@/schemas/apiSchema'

import {
  getLinkedCoreMediaNodeClass,
  isInputMediaPreview,
  shouldHideCoreInputMediaPreview,
  shouldHideCoreLoadAudioPlayer
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
  return {
    constructor: {
      comfyClass: nodeClass,
      nodeData: { isCoreNode }
    },
    inputs: linkedInputName
      ? [{ link: 1, widget: { name: linkedInputName } }]
      : []
  } as unknown as LGraphNode
}

function linkedWidget(name: string) {
  return { name, slotMetadata: { index: 0, linked: true, type: 'STRING' } }
}

describe(getLinkedCoreMediaNodeClass, () => {
  it.for([
    { nodeClass: 'LoadImage', selector: 'image' },
    { nodeClass: 'LoadVideo', selector: 'file' },
    { nodeClass: 'LoadAudio', selector: 'audio' }
  ] as const)(
    'matches core $nodeClass by its exact selector',
    ({ nodeClass, selector }) => {
      const node = mediaNode({ nodeClass })

      expect(getLinkedCoreMediaNodeClass(node, [linkedWidget(selector)])).toBe(
        nodeClass
      )
    }
  )

  it('excludes a custom node with a core class name', () => {
    const node = mediaNode({
      isCoreNode: false,
      linkedInputName: 'image',
      nodeClass: 'LoadImage'
    })

    expect(getLinkedCoreMediaNodeClass(node)).toBeUndefined()
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

      expect(getLinkedCoreMediaNodeClass(node)).toBeUndefined()
    }
  )

  it('ignores an unrelated linked widget', () => {
    const node = mediaNode({ linkedInputName: 'mask', nodeClass: 'LoadImage' })

    expect(getLinkedCoreMediaNodeClass(node)).toBeUndefined()
  })

  it('reads the live selector input and restores availability on disconnect', () => {
    const node = mediaNode({
      linkedInputName: 'audio',
      nodeClass: 'LoadAudio'
    })

    expect(shouldHideCoreLoadAudioPlayer(node)).toBe(true)

    node.inputs[0].link = null

    expect(shouldHideCoreLoadAudioPlayer(node)).toBe(false)
  })
})

describe(isInputMediaPreview, () => {
  const previewCases: {
    expected: boolean
    output: Pick<NodeExecutionOutput, 'images'> | undefined
  }[] = [
    {
      expected: true,
      output: { images: [{ type: 'input' }, { type: 'input' }] }
    },
    { expected: false, output: { images: [{ type: 'output' }] } },
    {
      expected: false,
      output: { images: [{ type: 'input' }, { type: 'output' }] }
    },
    { expected: false, output: { images: [] } },
    { expected: false, output: undefined }
  ]

  it.for(previewCases)(
    'classifies preview provenance $expected',
    ({ output, expected }) => {
      expect(isInputMediaPreview(output)).toBe(expected)
    }
  )

  it.for([
    { nodeClass: 'LoadImage', selector: 'image' },
    { nodeClass: 'LoadVideo', selector: 'file' }
  ] as const)(
    'hides only an input preview on core $nodeClass',
    ({ nodeClass, selector }) => {
      const node = mediaNode({ linkedInputName: selector, nodeClass })

      expect(
        shouldHideCoreInputMediaPreview(node, { images: [{ type: 'input' }] })
      ).toBe(true)
      expect(
        shouldHideCoreInputMediaPreview(node, { images: [{ type: 'output' }] })
      ).toBe(false)
      expect(
        shouldHideCoreInputMediaPreview(node, {
          images: [{ type: 'input' }, { type: 'output' }]
        })
      ).toBe(false)
      expect(shouldHideCoreInputMediaPreview(node, { images: [] })).toBe(false)
    }
  )
})
