import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { useMaskEditor } from '@/composables/maskeditor/useMaskEditor'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ContextMenuDivElement } from '@/lib/litegraph/src/types/contextMenu'
import { ComfyApp, app } from '@/scripts/app'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { filterUnavailableCoreMediaMenuActions } from '@/utils/coreMediaMenuActionUtils'

vi.mock(import('@/scripts/app'))

const openMaskEditorMock = vi.fn()

vi.mock(import('@/composables/maskeditor/useMaskEditor'), () => ({
  useMaskEditor: () =>
    fromPartial<ReturnType<typeof useMaskEditor>>({
      openMaskEditor: openMaskEditorMock
    })
}))

import '@/extensions/core/maskeditor'

const ext = vi.mocked(app.registerExtension).mock.calls[0][0]

function menuItems(node: LGraphNode) {
  return ext.getNodeMenuItems!(node)
}

function imageNode(): LGraphNode {
  return createMockLGraphNode({ imgs: [new Image()] })
}

describe('Comfy.MaskEditor getNodeMenuItems', () => {
  it('returns [] for nodes without an image preview', () => {
    expect(menuItems(createMockLGraphNode())).toEqual([])
  })

  it('returns [] while a clipspace return node is pending', () => {
    ComfyApp.clipspace_return_node = imageNode()

    expect(menuItems(imageNode())).toEqual([])
  })

  it('opens the mask editor for the right-clicked image node', async () => {
    const node = imageNode()
    const [item] = menuItems(node)

    expect(item?.content).toBe('Open in MaskEditor | Image Canvas')
    const menuElement: ContextMenuDivElement = document.createElement('div')
    await item?.callback?.call(menuElement)
    expect(openMaskEditorMock).toHaveBeenCalledWith(node)
  })

  it('marks the item as a preview action', () => {
    const items = menuItems(imageNode())

    expect(
      filterUnavailableCoreMediaMenuActions(items, new Set(['preview']))
    ).toEqual([])
    expect(
      filterUnavailableCoreMediaMenuActions(items, new Set(['input']))
    ).toEqual(items)
  })
})
