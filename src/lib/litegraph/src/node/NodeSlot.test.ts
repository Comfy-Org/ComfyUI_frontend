import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/litegraph'
import {
  NodeInputSlot,
  NodeOutputSlot,
  inputAsSerialisable,
  outputAsSerialisable
} from '@/lib/litegraph/src/litegraph'
import { SlotType } from '@/lib/litegraph/src/draw'
import type {
  DefaultConnectionColors,
  ReadOnlyRect
} from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import {
  LinkDirection,
  RenderShape
} from '@/lib/litegraph/src/types/globalEnums'
import { toLinkId } from '@/types/linkId'

const boundingRect: ReadOnlyRect = [0, 0, 10, 10]

type MockCanvasContext = CanvasRenderingContext2D & {
  arc: ReturnType<typeof vi.fn>
  beginPath: ReturnType<typeof vi.fn>
  clip: ReturnType<typeof vi.fn>
  closePath: ReturnType<typeof vi.fn>
  fill: ReturnType<typeof vi.fn>
  fillText: ReturnType<typeof vi.fn>
  lineTo: ReturnType<typeof vi.fn>
  moveTo: ReturnType<typeof vi.fn>
  rect: ReturnType<typeof vi.fn>
  restore: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
  stroke: ReturnType<typeof vi.fn>
}

function createContext(): MockCanvasContext {
  return fromPartial<MockCanvasContext>({
    fillStyle: '#initial-fill',
    strokeStyle: '#initial-stroke',
    lineWidth: 7,
    textAlign: 'start',
    arc: vi.fn(),
    beginPath: vi.fn(),
    clip: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    rect: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn()
  })
}

function createColors(): DefaultConnectionColors {
  return {
    getConnectedColor: vi.fn((type) => `connected-${type}`),
    getDisconnectedColor: vi.fn((type) => `disconnected-${type}`)
  }
}

function createNode(): LGraphNode {
  return {
    pos: [100, 200],
    _collapsed_width: 80
  } as LGraphNode
}

describe('NodeSlot', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'Path2D',
      class {
        arc = vi.fn()
      }
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('inputAsSerialisable', () => {
    it('removes _data from serialized slot', () => {
      const slot: INodeOutputSlot = {
        _data: 'test data',
        name: 'test-id',
        type: 'STRING',
        links: [],
        boundingRect
      }
      // @ts-expect-error Argument type mismatch for test
      const serialized = outputAsSerialisable(slot)
      expect(serialized).not.toHaveProperty('_data')
    })

    it('removes pos from widget input slots', () => {
      // Minimal slot for serialization test - boundingRect is calculated at runtime, not serialized
      const widgetInputSlot: INodeInputSlot = {
        name: 'test-id',
        pos: [10, 20],
        type: 'STRING',
        link: null,
        widget: { name: 'test-widget', type: 'combo' },
        boundingRect
      }

      const serialized = inputAsSerialisable(widgetInputSlot)
      expect(serialized).not.toHaveProperty('pos')
    })

    it('preserves pos for non-widget input slots', () => {
      const normalSlot: INodeInputSlot = {
        name: 'test-id',
        type: 'STRING',
        pos: [10, 20],
        link: null,
        boundingRect
      }
      const serialized = inputAsSerialisable(normalSlot)
      expect(serialized).toHaveProperty('pos')
    })

    it('preserves only widget name during serialization', () => {
      // Extra widget properties simulate real data that should be stripped during serialization
      const widgetInputSlot: INodeInputSlot = {
        name: 'test-id',
        type: 'STRING',
        link: null,
        boundingRect,
        widget: {
          name: 'test-widget',
          type: 'combo'
        }
      }

      const serialized = inputAsSerialisable(widgetInputSlot)
      expect(serialized.widget).toEqual({ name: 'test-widget' })
      expect(serialized.widget).not.toHaveProperty('type')
      expect(serialized.widget).not.toHaveProperty('value')
      expect(serialized.widget).not.toHaveProperty('options')
    })
  })

  describe('rendering', () => {
    it('draws an input label on the right and restores canvas styles', () => {
      const ctx = createContext()
      const slot = new NodeInputSlot(
        {
          name: 'input',
          label: 'Input label',
          type: 'FLOAT',
          link: null,
          boundingRect: [110, 210, 10, 10]
        },
        createNode()
      )

      slot.draw(ctx, { colorContext: createColors(), highlight: true })

      expect(ctx.arc).toHaveBeenCalledWith(15, 15, 5, 0, Math.PI * 2)
      expect(ctx.fillText).toHaveBeenCalledWith('Input label', 25, 20)
      expect(ctx.fillStyle).toBe('#initial-fill')
      expect(ctx.strokeStyle).toBe('#initial-stroke')
      expect(ctx.lineWidth).toBe(7)
      expect(ctx.textAlign).toBe('start')
    })

    it('draws output labels on the left and strokes output slots', () => {
      const ctx = createContext()
      const slot = new NodeOutputSlot(
        {
          name: 'output',
          localized_name: 'Localized output',
          type: 'FLOAT',
          links: [toLinkId(1)],
          boundingRect: [110, 210, 10, 10]
        },
        createNode()
      )

      slot.draw(ctx, { colorContext: createColors() })

      expect(ctx.stroke).toHaveBeenCalled()
      expect(ctx.fillText).toHaveBeenCalledWith('Localized output', 5, 20)
      expect(ctx.textAlign).toBe('start')
      expect(ctx.strokeStyle).toBe('#initial-stroke')
    })

    it('draws event, box, arrow, grid, and low-quality slot shapes', () => {
      const colorContext = createColors()
      const node = createNode()
      const eventCtx = createContext()
      const boxCtx = createContext()
      const arrowCtx = createContext()
      const gridCtx = createContext()
      const lowQualityCtx = createContext()

      new NodeInputSlot(
        {
          name: 'event',
          type: SlotType.Event,
          link: null,
          boundingRect: [110, 210, 10, 10]
        },
        node
      ).draw(eventCtx, { colorContext })
      new NodeInputSlot(
        {
          name: 'box',
          type: 'FLOAT',
          shape: RenderShape.BOX,
          link: null,
          boundingRect: [110, 210, 10, 10]
        },
        node
      ).draw(boxCtx, { colorContext })
      new NodeOutputSlot(
        {
          name: 'arrow',
          type: 'FLOAT',
          shape: RenderShape.ARROW,
          links: null,
          boundingRect: [110, 210, 10, 10]
        },
        node
      ).draw(arrowCtx, { colorContext })
      new NodeInputSlot(
        {
          name: 'grid',
          type: SlotType.Array,
          link: null,
          boundingRect: [110, 210, 10, 10]
        },
        node
      ).draw(gridCtx, { colorContext })
      new NodeInputSlot(
        {
          name: 'low',
          type: 'FLOAT',
          link: null,
          boundingRect: [110, 210, 10, 10]
        },
        node
      ).draw(lowQualityCtx, { colorContext, lowQuality: true })

      expect(eventCtx.rect).toHaveBeenCalled()
      expect(eventCtx.arc).not.toHaveBeenCalled()
      expect(boxCtx.rect).toHaveBeenCalled()
      expect(boxCtx.arc).not.toHaveBeenCalled()
      expect(arrowCtx.moveTo).toHaveBeenCalled()
      expect(arrowCtx.lineTo).toHaveBeenCalled()
      expect(arrowCtx.rect).not.toHaveBeenCalled()
      expect(arrowCtx.arc).not.toHaveBeenCalled()
      expect(gridCtx.rect.mock.calls.length).toBeGreaterThan(1)
      expect(gridCtx.arc).not.toHaveBeenCalled()
      expect(lowQualityCtx.rect).toHaveBeenCalled()
      expect(lowQualityCtx.arc).not.toHaveBeenCalled()
      expect(lowQualityCtx.fillText).not.toHaveBeenCalled()
    })

    it('draws hollow and multi-type slots', () => {
      const colorContext = createColors()
      const hollowCtx = createContext()
      const multiCtx = createContext()

      new NodeInputSlot(
        {
          name: 'hollow',
          type: 'FLOAT',
          shape: RenderShape.HollowCircle,
          link: null,
          boundingRect: [110, 210, 10, 10]
        },
        createNode()
      ).draw(hollowCtx, { colorContext, highlight: true })
      new NodeInputSlot(
        {
          name: 'multi',
          type: 'A,B,C,D,E',
          link: toLinkId(1),
          boundingRect: [110, 210, 10, 10]
        },
        createNode()
      ).draw(multiCtx, { colorContext })

      expect(hollowCtx.clip).toHaveBeenCalledWith(expect.any(Object), 'evenodd')
      expect(
        vi
          .mocked(colorContext.getConnectedColor)
          .mock.calls.some(([type]) => type === 'A')
      ).toBe(true)
      expect(multiCtx.fill.mock.calls.length).toBeGreaterThan(1)
      expect(multiCtx.stroke).toHaveBeenCalled()
    })

    it('hides widget input labels and draws error rings', () => {
      const ctx = createContext()
      const slot = new NodeInputSlot(
        {
          name: 'widget-input',
          label: 'Hidden label',
          type: 'FLOAT',
          link: null,
          widget: { name: 'widget' },
          hasErrors: true,
          boundingRect: [110, 210, 10, 10]
        },
        createNode()
      )

      slot.draw(ctx, { colorContext: createColors() })

      expect(ctx.fillText).not.toHaveBeenCalled()
      expect(ctx.arc).toHaveBeenCalledWith(15, 15, 12, 0, Math.PI * 2)
      expect(ctx.stroke).toHaveBeenCalled()
    })

    it('places directional labels above vertical slots', () => {
      const rightCtx = createContext()
      const leftCtx = createContext()
      const node = createNode()
      const input = new NodeInputSlot(
        {
          name: 'up',
          type: 'FLOAT',
          link: null,
          dir: LinkDirection.UP,
          boundingRect: [110, 210, 10, 10]
        },
        node
      )
      const output = new NodeOutputSlot(
        {
          name: 'down',
          type: 'FLOAT',
          links: null,
          dir: LinkDirection.DOWN,
          boundingRect: [110, 210, 10, 10]
        },
        node
      )

      input.draw(rightCtx, { colorContext: createColors() })
      output.draw(leftCtx, { colorContext: createColors() })

      expect(rightCtx.fillText).toHaveBeenCalledWith('up', 15, 5)
      expect(leftCtx.fillText).toHaveBeenCalledWith('down', 15, 7)
    })
  })

  describe('collapsed rendering', () => {
    it('draws collapsed input and output arrows on their own sides', () => {
      const inputCtx = createContext()
      const outputCtx = createContext()

      new NodeInputSlot(
        {
          name: 'input',
          type: 'FLOAT',
          shape: RenderShape.ARROW,
          link: null,
          boundingRect
        },
        createNode()
      ).drawCollapsed(inputCtx)
      new NodeOutputSlot(
        {
          name: 'output',
          type: 'FLOAT',
          shape: RenderShape.ARROW,
          links: null,
          boundingRect
        },
        createNode()
      ).drawCollapsed(outputCtx)

      expect(inputCtx.lineTo).toHaveBeenCalled()
      expect(outputCtx.lineTo).toHaveBeenCalled()
      expect(inputCtx.arc).not.toHaveBeenCalled()
      expect(outputCtx.arc).not.toHaveBeenCalled()

      const [inputArrowX] = inputCtx.moveTo.mock.calls[0] ?? []
      const [outputArrowX] = outputCtx.moveTo.mock.calls[0] ?? []
      expect(outputArrowX).toBeGreaterThan(inputArrowX)
    })

    it('draws collapsed event and circle slots', () => {
      const eventCtx = createContext()
      const circleCtx = createContext()

      new NodeInputSlot(
        {
          name: 'event',
          type: SlotType.Event,
          link: null,
          boundingRect
        },
        createNode()
      ).drawCollapsed(eventCtx)
      new NodeInputSlot(
        {
          name: 'circle',
          type: 'FLOAT',
          link: null,
          boundingRect
        },
        createNode()
      ).drawCollapsed(circleCtx)

      expect(eventCtx.rect).toHaveBeenCalled()
      expect(eventCtx.arc).not.toHaveBeenCalled()
      expect(circleCtx.arc).toHaveBeenCalled()
      expect(circleCtx.rect).not.toHaveBeenCalled()
      expect(circleCtx.fillStyle).toBe('#initial-fill')
    })
  })

  describe('serialization and validation', () => {
    it('serializes slot fields without the node reference', () => {
      const slot = new NodeOutputSlot(
        {
          name: 'out',
          type: 'FLOAT',
          label: 'Output',
          color_on: '#fff',
          color_off: '#000',
          shape: RenderShape.BOX,
          dir: LinkDirection.RIGHT,
          localized_name: 'Localized',
          pos: [1, 2],
          links: [toLinkId(3)],
          slot_index: 4,
          boundingRect: [1, 2, 3, 4]
        },
        createNode()
      )

      expect(slot.toJSON()).toEqual({
        name: 'out',
        type: 'FLOAT',
        label: 'Output',
        color_on: '#fff',
        color_off: '#000',
        shape: RenderShape.BOX,
        dir: LinkDirection.RIGHT,
        localized_name: 'Localized',
        pos: [1, 2],
        boundingRect: [1, 2, 3, 4],
        links: [toLinkId(3)],
        slot_index: 4
      })
    })

    it('validates input and output targets by slot direction', () => {
      const input = new NodeInputSlot(
        {
          name: 'input',
          type: 'FLOAT',
          link: null,
          boundingRect
        },
        createNode()
      )
      const output = new NodeOutputSlot(
        {
          name: 'output',
          type: 'FLOAT',
          links: null,
          boundingRect
        },
        createNode()
      )

      expect(input.isValidTarget(output)).toBe(true)
      expect(output.isValidTarget(input)).toBe(true)
      expect(input.isValidTarget(input)).toBe(false)
      expect(output.isValidTarget(output)).toBe(false)
    })
  })
})
