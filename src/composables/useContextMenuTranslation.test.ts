import { fromPartial } from '@total-typescript/shoehorn'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  IContextMenuOptions,
  IContextMenuValue,
  INodeInputSlot,
  IWidget
} from '@/lib/litegraph/src/litegraph'

const collectCanvasMenuItems = vi.fn()
const collectNodeMenuItems = vi.fn(() => [])

vi.mock('@/scripts/app', () => ({
  app: {
    get collectCanvasMenuItems() {
      return collectCanvasMenuItems
    },
    get collectNodeMenuItems() {
      return collectNodeMenuItems
    }
  }
}))
vi.mock('@/i18n', () => ({
  resolveNodeDefText: vi.fn(),
  st: (_key: string, fallback: string) => fallback,
  te: () => false
}))

const { translateContextMenuItems, useContextMenuTranslation } =
  await import('./useContextMenuTranslation')

describe('translateContextMenuItems', () => {
  it.for([
    ['Convert seed to input', 'Convert Seed label to input'],
    ['Convert seed to widget', 'Convert Seed label to widget']
  ])('prefers a label over the internal name', ([content, expected]) => {
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

describe('canvas menu contributions', () => {
  let canvas: LGraphCanvas
  let restoreGlobals: () => void

  beforeAll(() => {
    const canvasMenu = LGraphCanvas.prototype.getCanvasMenuOptions
    const nodeMenu = LGraphCanvas.prototype.getNodeMenuOptions
    const contextMenu = LiteGraph.ContextMenu

    LGraphCanvas.prototype.getCanvasMenuOptions = function () {
      return [{ content: 'Add Node' }, null, { content: 'Paste' }]
    }
    useContextMenuTranslation()

    restoreGlobals = () => {
      LGraphCanvas.prototype.getCanvasMenuOptions = canvasMenu
      LGraphCanvas.prototype.getNodeMenuOptions = nodeMenu
      LiteGraph.ContextMenu = contextMenu
    }
  })

  afterAll(() => restoreGlobals())

  beforeEach(() => {
    canvas = Object.create(LGraphCanvas.prototype) as LGraphCanvas
  })

  const options = () => LGraphCanvas.prototype.getCanvasMenuOptions.call(canvas)

  it('keeps the host menu when an extension contributes nothing', () => {
    collectCanvasMenuItems.mockReturnValue([undefined, null])

    expect(() => options()).not.toThrow()
    expect(
      options()
        .slice(0, 3)
        .map((item) => item?.content)
    ).toEqual(['Add Node', undefined, 'Paste'])
  })

  it('places a flagged item above Paste and appends the rest', () => {
    collectCanvasMenuItems.mockReturnValue([
      { content: 'Bundle', beforePaste: true },
      { content: 'Tail' }
    ])

    expect(options().map((item) => item?.content)).toEqual([
      'Add Node',
      undefined,
      'Bundle',
      'Paste',
      'Tail'
    ])
  })
})
