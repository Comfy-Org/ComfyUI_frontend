import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fromPartial } from '@total-typescript/shoehorn'

import type {
  DefaultConnectionColors,
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { SlotType } from '@/lib/litegraph/src/draw'
import {
  LinkDirection,
  RenderShape
} from '@/lib/litegraph/src/types/globalEnums'
import { toLinkId } from '@/types/linkId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { NodeInputSlot } from './NodeInputSlot'
import { NodeOutputSlot } from './NodeOutputSlot'

function createColorContext(): DefaultConnectionColors {
  return {
    getConnectedColor: vi.fn(() => '#0f0'),
    getDisconnectedColor: vi.fn(() => '#f00')
  }
}

function createNode(): LGraphNode {
  const node = new LGraphNode('Test Node')
  node.pos = [0, 0]
  return node
}

function createInputSlot(
  overrides: Partial<INodeInputSlot> = {},
  node = createNode()
): NodeInputSlot {
  return new NodeInputSlot(
    {
      name: 'in',
      type: 'STRING',
      link: null,
      boundingRect: [10, 20, 20, 20] as const,
      ...overrides
    },
    node
  )
}

function createOutputSlot(
  overrides: Partial<INodeOutputSlot> = {},
  node = createNode()
): NodeOutputSlot {
  return new NodeOutputSlot(
    {
      name: 'out',
      type: 'STRING',
      links: null,
      boundingRect: [10, 20, 20, 20] as const,
      ...overrides
    },
    node
  )
}

describe('NodeSlot rendering', () => {
  let ctx: CanvasRenderingContext2D
  let colorContext: DefaultConnectionColors

  beforeEach(() => {
    ctx = createMockCanvasRenderingContext2D()
    colorContext = createColorContext()
  })

  describe('draw', () => {
    it('draws a disconnected circle slot with its label', () => {
      const slot = createInputSlot()

      slot.draw(ctx, { colorContext })

      expect(colorContext.getDisconnectedColor).toHaveBeenCalledWith('STRING')
      expect(ctx.arc).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        4,
        0,
        Math.PI * 2
      )
      expect(ctx.fill).toHaveBeenCalled()
      expect(ctx.fillText).toHaveBeenCalledWith(
        'in',
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('uses the connected colour and a larger radius when highlighted', () => {
      const slot = createInputSlot({ link: toLinkId(1) })

      slot.draw(ctx, { colorContext, highlight: true })

      expect(colorContext.getConnectedColor).toHaveBeenCalledWith('STRING')
      expect(ctx.arc).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        5,
        0,
        Math.PI * 2
      )
    })

    it('prefers color_on over the colour context when connected', () => {
      const slot = createInputSlot({ link: toLinkId(1), color_on: '#abc' })
      let fillStyleAtFill: typeof ctx.fillStyle | undefined
      vi.mocked(ctx.fill).mockImplementation(() => {
        fillStyleAtFill = ctx.fillStyle
      })

      slot.draw(ctx, { colorContext })

      expect(fillStyleAtFill).toBe('#abc')
      expect(ctx.fillStyle).not.toBe('#abc') // restored after draw
    })

    it('draws a box for event slots', () => {
      const slot = createInputSlot({ type: SlotType.Event })

      slot.draw(ctx, { colorContext })

      expect(ctx.rect).toHaveBeenCalledTimes(1)
      expect(ctx.arc).not.toHaveBeenCalled()
    })

    it('draws a box for box-shaped slots', () => {
      const slot = createInputSlot({ shape: RenderShape.BOX })

      slot.draw(ctx, { colorContext })

      expect(ctx.rect).toHaveBeenCalledTimes(1)
    })

    it('draws a triangle for arrow-shaped slots', () => {
      const slot = createInputSlot({ shape: RenderShape.ARROW })

      slot.draw(ctx, { colorContext })

      expect(ctx.moveTo).toHaveBeenCalledTimes(1)
      expect(ctx.lineTo).toHaveBeenCalledTimes(2)
      expect(ctx.closePath).toHaveBeenCalled()
    })

    it('draws a 3x3 grid for array-typed slots', () => {
      const slot = createInputSlot({ type: SlotType.Array })

      slot.draw(ctx, { colorContext })

      expect(ctx.rect).toHaveBeenCalledTimes(9)
    })

    it('draws a simple rect and no label in low quality mode', () => {
      const slot = createInputSlot()

      slot.draw(ctx, { colorContext, lowQuality: true })

      expect(ctx.rect).toHaveBeenCalledTimes(1)
      expect(ctx.fillText).not.toHaveBeenCalled()
    })

    it('clips hollow circle slots to a ring', () => {
      const arc = vi.fn()
      vi.stubGlobal(
        'Path2D',
        class {
          arc = arc
        }
      )
      try {
        const slot = createInputSlot({ shape: RenderShape.HollowCircle })

        slot.draw(ctx, { colorContext, highlight: true })
        slot.draw(ctx, { colorContext })

        expect(ctx.clip).toHaveBeenCalledTimes(2)
        // Inner radius is larger while highlighted.
        expect(arc).toHaveBeenCalledWith(
          expect.any(Number),
          expect.any(Number),
          2.5,
          0,
          Math.PI * 2
        )
        expect(arc).toHaveBeenCalledWith(
          expect.any(Number),
          expect.any(Number),
          1.5,
          0,
          Math.PI * 2
        )
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('draws one pie segment per type for multi-type slots', () => {
      const slot = createInputSlot({ type: 'STRING,INT' })

      slot.draw(ctx, { colorContext })

      // Once for the base slot colour, then once per type in the pie.
      expect(colorContext.getDisconnectedColor).toHaveBeenCalledTimes(3)
      // One filled arc per type, plus the final outline arc.
      expect(ctx.arc).toHaveBeenCalledTimes(3)
      expect(ctx.stroke).toHaveBeenCalled()
    })

    it('hides the label for widget input slots', () => {
      const slot = createInputSlot({ widget: { name: 'in' } })

      slot.draw(ctx, { colorContext })

      expect(ctx.fillText).not.toHaveBeenCalled()
    })

    it('skips the label when there is no text to render', () => {
      const slot = createInputSlot({ name: '' })

      slot.draw(ctx, { colorContext })

      expect(ctx.fillText).not.toHaveBeenCalled()
    })

    it('draws input labels above the slot when directed up', () => {
      const slot = createInputSlot({ dir: LinkDirection.UP })

      slot.draw(ctx, { colorContext })

      const [, x, y] = vi.mocked(ctx.fillText).mock.calls[0]
      const slotCentre = [
        slot.boundingRect[0] + 10 - slot.node.pos[0],
        slot.boundingRect[1] + 10 - slot.node.pos[1]
      ]
      expect(x).toBe(slotCentre[0])
      expect(y).toBeLessThan(slotCentre[1])
    })

    it('draws output labels to the left of the slot', () => {
      const slot = createOutputSlot()

      slot.draw(ctx, { colorContext })

      const [, x] = vi.mocked(ctx.fillText).mock.calls[0]
      const slotCentreX = slot.boundingRect[0] + 10 - slot.node.pos[0]
      expect(x).toBeLessThan(slotCentreX)
    })

    it('draws output labels above the slot when directed down', () => {
      const slot = createOutputSlot({ dir: LinkDirection.DOWN })

      slot.draw(ctx, { colorContext })

      const [, , y] = vi.mocked(ctx.fillText).mock.calls[0]
      const slotCentreY = slot.boundingRect[1] + 10 - slot.node.pos[1]
      expect(y).toBeLessThan(slotCentreY)
    })

    it('strokes output slots in normal quality', () => {
      const slot = createOutputSlot()

      slot.draw(ctx, { colorContext })

      expect(ctx.stroke).toHaveBeenCalled()
    })

    it('does not stroke output slots in low quality', () => {
      const slot = createOutputSlot()

      slot.draw(ctx, { colorContext, lowQuality: true })

      expect(ctx.stroke).not.toHaveBeenCalled()
    })

    it('rings the slot in red when it has errors', () => {
      const slot = createInputSlot({ hasErrors: true })

      slot.draw(ctx, { colorContext })

      expect(ctx.arc).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        12,
        0,
        Math.PI * 2
      )
      expect(ctx.stroke).toHaveBeenCalled()
    })
  })

  describe('highlightColor', () => {
    const original = {
      highlight: LiteGraph.NODE_TEXT_HIGHLIGHT_COLOR,
      selectedTitle: LiteGraph.NODE_SELECTED_TITLE_COLOR
    }

    afterEach(() => {
      LiteGraph.NODE_TEXT_HIGHLIGHT_COLOR = original.highlight
      LiteGraph.NODE_SELECTED_TITLE_COLOR = original.selectedTitle
    })

    it('prefers the dedicated text highlight colour', () => {
      expect(createInputSlot().highlightColor).toBe(
        LiteGraph.NODE_TEXT_HIGHLIGHT_COLOR
      )
    })

    it('falls back to the selected title colour, then text colour', () => {
      LiteGraph.NODE_TEXT_HIGHLIGHT_COLOR = undefined
      expect(createInputSlot().highlightColor).toBe(
        LiteGraph.NODE_SELECTED_TITLE_COLOR
      )

      LiteGraph.NODE_SELECTED_TITLE_COLOR = undefined
      expect(createInputSlot().highlightColor).toBe(LiteGraph.NODE_TEXT_COLOR)
    })
  })

  describe('renderingLabel', () => {
    it.for<[string, Partial<NodeInputSlot>, string]>([
      ['label', { label: 'A Label', localized_name: 'Localized' }, 'A Label'],
      ['localized_name', { localized_name: 'Localized' }, 'Localized'],
      ['name', {}, 'in'],
      ['empty string', { name: '' }, '']
    ])('falls back through %s', ([, overrides, expected]) => {
      expect(createInputSlot(overrides).renderingLabel).toBe(expected)
    })
  })

  describe('drawCollapsed', () => {
    it('draws a box for event slots', () => {
      createInputSlot({ type: SlotType.Event }).drawCollapsed(ctx)

      expect(ctx.rect).toHaveBeenCalledTimes(1)
      expect(ctx.fill).toHaveBeenCalled()
    })

    it('draws a box for box-shaped slots', () => {
      createInputSlot({ shape: RenderShape.BOX }).drawCollapsed(ctx)

      expect(ctx.rect).toHaveBeenCalledTimes(1)
    })

    it('draws an input-facing arrow for arrow-shaped input slots', () => {
      createInputSlot({ shape: RenderShape.ARROW }).drawCollapsed(ctx)

      expect(ctx.moveTo).toHaveBeenCalledWith(8, expect.any(Number))
      expect(ctx.closePath).toHaveBeenCalled()
    })

    it('draws an output-facing arrow for arrow-shaped output slots', () => {
      const node = createNode()
      node._collapsed_width = 60
      createOutputSlot({ shape: RenderShape.ARROW }, node).drawCollapsed(ctx)

      expect(ctx.moveTo).toHaveBeenCalledWith(66, expect.any(Number))
    })

    it('draws a circle by default', () => {
      createInputSlot().drawCollapsed(ctx)

      expect(ctx.arc).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        4,
        0,
        Math.PI * 2
      )
    })
  })

  describe('collapsedPos', () => {
    it('places output slots at the collapsed node width', () => {
      const node = createNode()
      node._collapsed_width = 42

      expect(createOutputSlot({}, node).collapsedPos[0]).toBe(42)
    })

    it('falls back to the default collapsed width', () => {
      const slot = createOutputSlot()

      expect(slot.collapsedPos[0]).toBe(LiteGraph.NODE_COLLAPSED_WIDTH)
    })

    it('places input slots at the node origin', () => {
      expect(createInputSlot().collapsedPos[0]).toBe(0)
    })
  })

  describe('isValidTarget', () => {
    it('validates input slots against output slots', () => {
      const input = createInputSlot()
      const output = createOutputSlot()

      expect(input.isValidTarget(output)).toBe(true)
      expect(output.isValidTarget(input)).toBe(true)
    })

    it('rejects connections between incompatible slot types', () => {
      const input = createInputSlot()
      const output = createOutputSlot({ type: 'INT' })

      expect(input.isValidTarget(output)).toBe(false)
    })

    it('validates output slots against subgraph outputs', () => {
      const subgraph = createTestSubgraph({
        outputs: [{ name: 'value', type: 'STRING' }]
      })
      const subgraphOutput = subgraph.outputNode.slots[0]

      expect(createOutputSlot().isValidTarget(subgraphOutput)).toBe(true)
      expect(createOutputSlot({ type: 'INT' }).isValidTarget(subgraphOutput)) //
        .toBe(false)
    })

    it('validates input slots against subgraph inputs', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'STRING' }]
      })
      const subgraphInput = subgraph.inputNode.slots[0]

      expect(createInputSlot().isValidTarget(subgraphInput)).toBe(true)
    })

    it('rejects unknown slot shapes', () => {
      const input = createInputSlot()
      const output = createOutputSlot()

      expect(input.isValidTarget(fromPartial({ type: 'STRING' }))).toBe(false)
      expect(output.isValidTarget(fromPartial({ type: 'STRING' }))).toBe(false)
    })
  })

  describe('isConnected', () => {
    it('reports output connectivity from the links array', () => {
      expect(createOutputSlot().isConnected).toBe(false)
      expect(createOutputSlot({ links: [] }).isConnected).toBe(false)
      expect(createOutputSlot({ links: [toLinkId(1)] }).isConnected).toBe(true)
    })
  })
})
