import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import type {
  IContextMenuOptions,
  IContextMenuValue,
  INodeInputSlot,
  IWidget
} from '@/lib/litegraph/src/litegraph'

import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'

import {
  translateContextMenuItems,
  useContextMenuTranslation
} from './useContextMenuTranslation'

vi.mock(import('@/i18n'), () => ({
  resolveNodeDefText: vi.fn(),
  st: (_key: string, fallback: string) => fallback,
  te: () => false
}))

describe('translateContextMenuItems', () => {
  it.for([
    ['Convert seed to input', 'Convert Seed label to input'],
    ['Convert seed to widget', 'Convert Seed label to widget']
  ])('prefers a label over the internal name in %s', ([content, expected]) => {
    const values = [fromPartial<IContextMenuValue>({ content })]
    const options = fromPartial<IContextMenuOptions>({
      extra: {
        inputs: [
          fromPartial<INodeInputSlot>({ name: 'seed', label: 'Seed label' })
        ],
        widgets: [fromPartial<IWidget>({ name: 'seed' })]
      }
    })

    translateContextMenuItems(values, options)

    expect(values[0].content).toBe(expected)
  })
})

describe('useContextMenuTranslation', () => {
  it('opens a LiteGraph.ContextMenu constructed without options', () => {
    const OriginalContextMenu = LiteGraph.ContextMenu
    const prototype = LGraphCanvas.prototype
    const canvasMenu = Object.getOwnPropertyDescriptor(
      prototype,
      'getCanvasMenuOptions'
    )
    const nodeMenu = Object.getOwnPropertyDescriptor(
      prototype,
      'getNodeMenuOptions'
    )
    assert.exists(canvasMenu)
    assert.exists(nodeMenu)
    onTestFinished(() => {
      LiteGraph.ContextMenu = OriginalContextMenu
      Object.defineProperty(prototype, 'getCanvasMenuOptions', canvasMenu)
      Object.defineProperty(prototype, 'getNodeMenuOptions', nodeMenu)
    })
    useContextMenuTranslation()

    const menu = new LiteGraph.ContextMenu(['First', 'Second'])
    onTestFinished(() => menu.close())

    expect(menu).toBeInstanceOf(OriginalContextMenu)
    expect(menu.root.textContent).toContain('Second')
  })
})
