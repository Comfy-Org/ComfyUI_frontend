import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, vi } from 'vitest'

import type { useMaskEditor } from '@/composables/maskeditor/useMaskEditor'
import type {
  IContextMenuValue,
  LGraphCanvas
} from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ContextMenuDivElement } from '@/lib/litegraph/src/interfaces'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
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
const canvas = fromPartial<LGraphCanvas>({})
const nodeData = fromPartial<ComfyNodeDef>({ name: 'LoadImage' })

async function registerNodeType(
  original?: LGraphNode['getExtraMenuOptions']
): Promise<typeof LGraphNode> {
  class TestNode extends LGraphNode {}
  if (original) TestNode.prototype.getExtraMenuOptions = original
  assert.exists(ext.beforeRegisterNodeDef)
  await ext.beforeRegisterNodeDef(TestNode, nodeData, app)
  return TestNode
}

function menuOptions(
  nodeType: typeof LGraphNode,
  node: LGraphNode
): (IContextMenuValue | null)[] {
  const options: (IContextMenuValue | null)[] = []
  assert.exists(nodeType.prototype.getExtraMenuOptions)
  nodeType.prototype.getExtraMenuOptions.call(node, canvas, options)
  return options
}

function imageNode(): LGraphNode {
  return createMockLGraphNode({ imgs: [new Image()] })
}

describe('Comfy.MaskEditor getExtraMenuOptions', () => {
  it('adds nothing for nodes without an image preview', async () => {
    const nodeType = await registerNodeType()

    expect(menuOptions(nodeType, createMockLGraphNode())).toEqual([])
  })

  it('adds nothing while a clipspace return node is pending', async () => {
    ComfyApp.clipspace_return_node = imageNode()
    const nodeType = await registerNodeType()

    expect(menuOptions(nodeType, imageNode())).toEqual([])
  })

  it('opens the mask editor for the right-clicked image node', async () => {
    const nodeType = await registerNodeType()
    const node = imageNode()
    const [item] = menuOptions(nodeType, node)

    expect(item?.content).toBe('Open in MaskEditor | Image Canvas')
    const menuElement: ContextMenuDivElement = document.createElement('div')
    await item?.callback?.call(menuElement)
    expect(openMaskEditorMock).toHaveBeenCalledWith(node)
  })

  it('marks the item as a preview action', async () => {
    const nodeType = await registerNodeType()
    const items = menuOptions(nodeType, imageNode())

    expect(items).toHaveLength(1)
    expect(
      filterUnavailableCoreMediaMenuActions(items, new Set(['preview']))
    ).toEqual([])
    expect(
      filterUnavailableCoreMediaMenuActions(items, new Set(['input']))
    ).toEqual(items)
  })

  it('appends after the existing handler and keeps its return value', async () => {
    const originalResult: IContextMenuValue[] = [{ content: 'Original' }]
    const original = vi.fn(function (
      this: LGraphNode,
      _canvas: LGraphCanvas,
      options: (IContextMenuValue | null)[]
    ) {
      options.push({ content: 'Core' })
      return originalResult
    })
    const nodeType = await registerNodeType(original)
    const node = imageNode()
    const options: (IContextMenuValue | null)[] = []

    assert.exists(nodeType.prototype.getExtraMenuOptions)
    const result = nodeType.prototype.getExtraMenuOptions.call(
      node,
      canvas,
      options
    )

    expect(original.mock.contexts[0]).toBe(node)
    expect(options.map((item) => item?.content)).toEqual([
      'Core',
      'Open in MaskEditor | Image Canvas'
    ])
    expect(result).toBe(originalResult)
  })
})
