import { describe, expect, it } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import {
  hasLinkedInputPreviewWidget,
  isInputMediaPreview
} from './linkedWidgetUtils'

function mediaNode(imageInputName: string, isCoreNode = true): LGraphNode {
  return {
    constructor: {
      nodeData: {
        input: {
          required: {
            upload: ['IMAGEUPLOAD', { imageInputName }]
          }
        },
        isCoreNode
      }
    }
  } as unknown as LGraphNode
}

describe(hasLinkedInputPreviewWidget, () => {
  it('uses the explicit IMAGEUPLOAD source widget', () => {
    const node = mediaNode('image')

    expect(
      hasLinkedInputPreviewWidget(node, [
        {
          name: 'mask',
          slotMetadata: { index: 0, linked: true, type: 'IMAGE' }
        },
        {
          name: 'image',
          slotMetadata: { index: 1, linked: true, type: 'IMAGE' }
        }
      ])
    ).toBe(true)
  })

  it('ignores a linked widget that is not the IMAGEUPLOAD source', () => {
    const node = mediaNode('image')

    expect(
      hasLinkedInputPreviewWidget(node, [
        {
          name: 'mask',
          slotMetadata: { index: 0, linked: true, type: 'IMAGE' }
        },
        {
          name: 'image',
          slotMetadata: { index: 1, linked: false, type: 'IMAGE' }
        }
      ])
    ).toBe(false)
  })

  it('leaves custom node previews unchanged', () => {
    const node = mediaNode('image', false)

    expect(
      hasLinkedInputPreviewWidget(node, [
        {
          name: 'image',
          slotMetadata: { index: 0, linked: true, type: 'IMAGE' }
        }
      ])
    ).toBe(false)
  })
})

describe(isInputMediaPreview, () => {
  it('accepts only local input media', () => {
    expect(
      isInputMediaPreview({ images: [{ type: 'input' }, { type: 'input' }] })
    ).toBe(true)
    expect(isInputMediaPreview({ images: [{ type: 'output' }] })).toBe(false)
    expect(
      isInputMediaPreview({ images: [{ type: 'input' }, { type: 'output' }] })
    ).toBe(false)
  })
})
