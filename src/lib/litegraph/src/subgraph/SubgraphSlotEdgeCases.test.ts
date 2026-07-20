import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  Point
} from '@/lib/litegraph/src/interfaces'
import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type { SubgraphIO } from '@/lib/litegraph/src/types/serialisation'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { toLinkId } from '@/types/linkId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import { SubgraphInput } from './SubgraphInput'
import {
  createTestSubgraph,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function createIoSubgraph() {
  return createTestSubgraph({
    inputs: [{ name: 'in', type: 'STRING' }],
    outputs: [{ name: 'out', type: 'STRING' }]
  })
}

function addInnerNode(subgraph: Subgraph, type = 'STRING') {
  const node = new LGraphNode('Inner')
  node.addInput('in', type)
  node.addOutput('out', type)
  subgraph.add(node)
  return node
}

const colorContext = {
  getConnectedColor: () => '#0f0',
  getDisconnectedColor: () => '#f00'
}

describe('SubgraphOutput.connect', () => {
  it('rejects type-incompatible connections', () => {
    const subgraph = createIoSubgraph()
    const node = addInnerNode(subgraph, 'INT')

    const link = subgraph.outputs[0].connect(node.outputs[0], node)

    expect(link).toBeUndefined()
    expect(subgraph.outputs[0].linkIds).toHaveLength(0)
  })

  it('throws when the slot does not belong to the given node', () => {
    const subgraph = createIoSubgraph()
    const node = addInnerNode(subgraph)
    const otherNode = addInnerNode(subgraph)

    expect(() =>
      subgraph.outputs[0].connect(otherNode.outputs[0], node)
    ).toThrow('Slot is not an output of the given node')
  })

  it('lets nodes veto the connection via onConnectOutput', () => {
    const subgraph = createIoSubgraph()
    const node = addInnerNode(subgraph)
    node.onConnectOutput = () => false

    expect(subgraph.outputs[0].connect(node.outputs[0], node)).toBeUndefined()
  })

  it('replaces an existing connection', () => {
    const subgraph = createIoSubgraph()
    const first = addInnerNode(subgraph)
    const second = addInnerNode(subgraph)

    subgraph.outputs[0].connect(first.outputs[0], first)
    const replacement = subgraph.outputs[0].connect(second.outputs[0], second)

    expect(replacement).toBeDefined()
    expect(subgraph.outputs[0].linkIds).toEqual([replacement?.id])
    expect(first.outputs[0].links).toEqual([])
    expect(second.outputs[0].links).toEqual([replacement?.id])
  })
})

describe('SubgraphOutput.disconnect', () => {
  it('skips dangling link ids', () => {
    const subgraph = createIoSubgraph()
    subgraph.outputs[0].linkIds.push(toLinkId(999))

    subgraph.outputs[0].disconnect()

    expect(subgraph.outputs[0].linkIds).toHaveLength(0)
  })

  it('removes link references from the origin output', () => {
    const subgraph = createIoSubgraph()
    const node = addInnerNode(subgraph)
    const onConnectionsChange = vi.fn()
    node.onConnectionsChange = onConnectionsChange
    subgraph.outputs[0].connect(node.outputs[0], node)

    subgraph.outputs[0].disconnect()

    expect(node.outputs[0].links).toEqual([])
    expect(onConnectionsChange).toHaveBeenLastCalledWith(
      expect.anything(),
      0,
      false,
      expect.anything(),
      subgraph.outputs[0]
    )
  })
})

describe('SubgraphOutput.isValidTarget', () => {
  it('accepts a compatible subgraph input as source', () => {
    const subgraph = createIoSubgraph()

    expect(subgraph.outputs[0].isValidTarget(subgraph.inputs[0])).toBe(true)
  })
})

describe('SubgraphInput.connect', () => {
  it('lets nodes veto the connection via onConnectInput', () => {
    const subgraph = createIoSubgraph()
    const node = addInnerNode(subgraph)
    node.onConnectInput = () => false

    expect(subgraph.inputs[0].connect(node.inputs[0], node)).toBeUndefined()
  })

  it('disconnects an existing link on the target input first', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'a', type: 'STRING' },
        { name: 'b', type: 'STRING' }
      ]
    })
    const node = addInnerNode(subgraph)
    subgraph.inputs[0].connect(node.inputs[0], node)

    const replacement = subgraph.inputs[1].connect(node.inputs[0], node)

    expect(replacement).toBeDefined()
    expect(node.inputs[0].link).toBe(replacement?.id)
    expect(subgraph.inputs[0].linkIds).toHaveLength(0)
  })

  it('rejects widget inputs that do not match the bound widget', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const subgraph = createIoSubgraph()

    const textNode = new LGraphNode('Text')
    const textInput = textNode.addInput('value', 'STRING')
    textNode.addWidget('text', 'value', '', () => {})
    textInput.widget = { name: 'value' }
    subgraph.add(textNode)

    const numberNode = new LGraphNode('Number')
    const numberInput = numberNode.addInput('value', 'STRING')
    numberNode.addWidget('number', 'value', 0, () => {})
    numberInput.widget = { name: 'value' }
    subgraph.add(numberNode)

    const first = subgraph.inputs[0].connect(textInput, textNode)
    const second = subgraph.inputs[0].connect(numberInput, numberNode)

    expect(first).toBeDefined()
    expect(second).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(
      'Target input has invalid widget.',
      numberInput,
      numberNode
    )
  })
})

describe('SubgraphInput.matchesWidget', () => {
  it('accepts any widget when none is bound', () => {
    const subgraph = createIoSubgraph()

    expect(
      subgraph.inputs[0].matchesWidget(
        fromPartial({ type: 'text', options: {} })
      )
    ).toBe(true)
  })

  it('compares type and numeric constraint options', () => {
    const subgraph = createIoSubgraph()
    const node = new LGraphNode('Widget Host')
    const input = node.addInput('value', 'STRING')
    node.addWidget('number', 'value', 0, () => {}, { min: 0, max: 10 })
    input.widget = { name: 'value' }
    subgraph.add(node)
    subgraph.inputs[0].connect(input, node)

    const boundOptions = { min: 0, max: 10 }
    expect(
      subgraph.inputs[0].matchesWidget(
        fromPartial({ type: 'number', options: { ...boundOptions } })
      )
    ).toBe(true)
    expect(
      subgraph.inputs[0].matchesWidget(
        fromPartial({ type: 'number', options: { ...boundOptions, min: 5 } })
      )
    ).toBe(false)
    expect(
      subgraph.inputs[0].matchesWidget(
        fromPartial({ type: 'text', options: { ...boundOptions } })
      )
    ).toBe(false)
  })
})

describe('SubgraphInput.getConnectedWidgets', () => {
  it('reports an error for dangling link ids', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const subgraph = createIoSubgraph()
    subgraph.inputs[0].linkIds.push(toLinkId(999))

    expect(subgraph.inputs[0].getConnectedWidgets()).toEqual([])
    expect(error).toHaveBeenCalledWith('Link not found', 999)
  })

  it('skips inputs without widgets', () => {
    const subgraph = createIoSubgraph()
    const node = addInnerNode(subgraph)
    node.addWidget('text', 'unrelated', '', () => {})
    subgraph.inputs[0].connect(node.inputs[0], node)

    expect(subgraph.inputs[0].getConnectedWidgets()).toEqual([])
  })

  it('warns when the referenced widget cannot be found', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const subgraph = createIoSubgraph()
    const node = new LGraphNode('Widget Host')
    const input = node.addInput('value', 'STRING')
    node.addWidget('text', 'value', '', () => {})
    input.widget = { name: 'value' }
    subgraph.add(node)
    subgraph.inputs[0].connect(input, node)

    input.widget = { name: 'missing' }
    expect(subgraph.inputs[0].getConnectedWidgets()).toEqual([])
    expect(warn).toHaveBeenCalledWith('Widget not found', { name: 'missing' })

    input.widget = { name: '' }
    expect(subgraph.inputs[0].getConnectedWidgets()).toEqual([])
    expect(warn).toHaveBeenCalledWith('Invalid widget name', { name: '' })
  })

  it('returns widgets for connected widget inputs', () => {
    const subgraph = createIoSubgraph()
    const node = new LGraphNode('Widget Host')
    const input = node.addInput('value', 'STRING')
    const widget = node.addWidget('text', 'value', '', () => {})
    input.widget = { name: 'value' }
    subgraph.add(node)
    subgraph.inputs[0].connect(input, node)

    expect(subgraph.inputs[0].getConnectedWidgets()).toEqual([widget])
  })
})

describe('SubgraphInput.isValidTarget', () => {
  it('accepts a compatible subgraph output as source', () => {
    const subgraph = createIoSubgraph()

    expect(subgraph.inputs[0].isValidTarget(subgraph.outputs[0])).toBe(true)
  })
})

describe('SubgraphSlot base behaviour', () => {
  it('ignores malformed positions', () => {
    const subgraph = createIoSubgraph()
    const slot = subgraph.inputs[0]
    slot.pos = [3, 4]

    slot.pos = fromPartial<Point>([5])

    expect([slot.pos[0], slot.pos[1]]).toEqual([3, 4])
  })

  it('generates an id when the serialised slot has none', () => {
    const subgraph = createIoSubgraph()
    const slot = new SubgraphInput(
      fromPartial<SubgraphIO>({ name: 'anon', type: 'STRING', linkIds: [] }),
      subgraph.inputNode
    )

    expect(slot.id).toEqual(expect.any(String))
    expect(slot.id.length).toBeGreaterThan(0)
  })

  it('skips dangling link ids in getLinks', () => {
    const subgraph = createIoSubgraph()
    subgraph.inputs[0].linkIds.push(toLinkId(999))

    expect(subgraph.inputs[0].getLinks()).toEqual([])
  })

  it('decrements link slot indices and warns on dangling ids', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const subgraph = createIoSubgraph()
    const node = addInnerNode(subgraph)
    const link = subgraph.outputs[0].connect(node.outputs[0], node)
    const slot = subgraph.outputs[0]

    slot.decrementSlots('outputs')
    expect(link?.target_slot).toBe(-1)

    slot.linkIds.push(toLinkId(999))
    slot.decrementSlots('outputs')
    expect(warn).toHaveBeenCalledWith('decrementSlots: link ID not found', 999)
  })

  describe('draw', () => {
    it('draws a simple square in low quality', () => {
      const subgraph = createIoSubgraph()
      const ctx = createMockCanvasRenderingContext2D()

      subgraph.inputs[0].draw({ ctx, colorContext, lowQuality: true })

      expect(ctx.rect).toHaveBeenCalledTimes(1)
      expect(ctx.arc).not.toHaveBeenCalled()
    })

    it('strokes hollow circles with a hover-dependent radius', () => {
      const subgraph = createIoSubgraph()
      const slot = subgraph.inputs[0]
      slot.shape = RenderShape.HollowCircle
      const ctx = createMockCanvasRenderingContext2D()

      slot.draw({ ctx, colorContext })
      slot.isPointerOver = true
      slot.draw({ ctx, colorContext })

      expect(ctx.arc).toHaveBeenNthCalledWith(1, 0, 0, 3, 0, Math.PI * 2)
      expect(ctx.arc).toHaveBeenNthCalledWith(2, 0, 0, 4, 0, Math.PI * 2)
      expect(ctx.stroke).toHaveBeenCalledTimes(2)
    })

    it('enlarges the highlighted filled circle', () => {
      const subgraph = createIoSubgraph()
      const slot = subgraph.inputs[0]
      slot.isPointerOver = true
      const ctx = createMockCanvasRenderingContext2D()

      slot.draw({ ctx, colorContext })

      expect(ctx.arc).toHaveBeenCalledWith(0, 0, 5, 0, Math.PI * 2)
    })

    it('dims slots that are invalid targets for the dragged link', () => {
      const subgraph = createIoSubgraph()
      const slot = subgraph.inputs[0]
      const alphas: number[] = []
      const ctx = createMockCanvasRenderingContext2D({
        fill: vi.fn(() => {
          alphas.push(ctx.globalAlpha)
        })
      })

      // Dragging from an incompatible output slot.
      const incompatible = fromPartial<INodeOutputSlot>({
        name: 'other',
        type: 'INT',
        links: null,
        boundingRect: [0, 0, 0, 0]
      })
      slot.draw({ ctx, colorContext, fromSlot: incompatible })

      expect(alphas[0]).toBeCloseTo(0.4)
    })

    it('falls back to the default label colour when unset', () => {
      const originalColor = LiteGraph.NODE_TEXT_COLOR
      try {
        LiteGraph.NODE_TEXT_COLOR = ''
        const subgraph = createIoSubgraph()
        const fillStyles: unknown[] = []
        const ctx = createMockCanvasRenderingContext2D({
          fillText: vi.fn(() => {
            fillStyles.push(ctx.fillStyle)
          })
        })

        subgraph.inputs[0].draw({ ctx, colorContext })

        expect(fillStyles).toEqual(['#AAA'])
      } finally {
        LiteGraph.NODE_TEXT_COLOR = originalColor
      }
    })
  })
})

describe('SubgraphOutputNode interaction', () => {
  function createArrangedOutputNode() {
    const subgraph = createIoSubgraph()
    const outputNode = subgraph.outputNode
    outputNode.configure({ id: outputNode.id, bounding: [0, 0, 150, 100] })
    outputNode.arrange()
    return { subgraph, outputNode }
  }

  function slotCentre(slot: { boundingRect: ArrayLike<number> }) {
    const [x, y, width, height] = Array.from(slot.boundingRect)
    return [x + width / 2, y + height / 2] as const
  }

  it('wires drag handlers on left-click over a slot', () => {
    const { subgraph, outputNode } = createArrangedOutputNode()
    const slot = outputNode.slots[0]
    const pointer = fromPartial<CanvasPointer>({})
    const linkConnector = fromPartial<LinkConnector>({
      dragNewFromSubgraphOutput: vi.fn(),
      dropLinks: vi.fn(),
      reset: vi.fn()
    })
    const [x, y] = slotCentre(slot)

    outputNode.onPointerDown(
      fromPartial<CanvasPointerEvent>({ canvasX: x, canvasY: y, button: 0 }),
      pointer,
      linkConnector
    )

    pointer.onDragStart?.(pointer)
    expect(linkConnector.dragNewFromSubgraphOutput).toHaveBeenCalledWith(
      subgraph,
      outputNode,
      slot
    )
    pointer.onDragEnd?.(fromPartial<CanvasPointerEvent>({}))
    expect(linkConnector.dropLinks).toHaveBeenCalled()
    pointer.finally?.()
    expect(linkConnector.reset).toHaveBeenCalledWith(true)
  })

  it('shows the slot context menu on right-click', () => {
    const { outputNode } = createArrangedOutputNode()
    const OriginalContextMenu = LiteGraph.ContextMenu
    let constructed = false
    LiteGraph.ContextMenu = fromPartial<typeof LiteGraph.ContextMenu>(
      class {
        constructor() {
          constructed = true
        }
      }
    )
    try {
      const [x, y] = slotCentre(outputNode.slots[0])
      outputNode.onPointerDown(
        fromPartial<CanvasPointerEvent>({ canvasX: x, canvasY: y, button: 2 }),
        fromPartial<CanvasPointer>({}),
        fromPartial<LinkConnector>({})
      )
      expect(constructed).toBe(true)

      constructed = false
      outputNode.onPointerDown(
        fromPartial<CanvasPointerEvent>({
          canvasX: 500,
          canvasY: 500,
          button: 2
        }),
        fromPartial<CanvasPointer>({}),
        fromPartial<LinkConnector>({})
      )
      expect(constructed).toBe(false)
    } finally {
      LiteGraph.ContextMenu = OriginalContextMenu
    }
  })

  it('connects by type through connectByTypeOutput', () => {
    const { subgraph, outputNode } = createArrangedOutputNode()
    const node = addInnerNode(subgraph)

    const link = outputNode.connectByTypeOutput(0, node, 'STRING')

    expect(link).toBeDefined()
    expect(subgraph.outputs[0].linkIds).toEqual([link?.id])
  })

  it('returns undefined when no output of the requested type exists', () => {
    const { outputNode } = createArrangedOutputNode()
    const node = new LGraphNode('No Outputs')

    expect(outputNode.connectByTypeOutput(0, node, 'STRING')).toBeUndefined()
  })
})

describe('SubgraphInputNode connections', () => {
  it('throws for invalid slot indices in connectSlots', () => {
    const subgraph = createIoSubgraph()
    const node = addInnerNode(subgraph)

    expect(() =>
      subgraph.inputNode.connectSlots(
        fromPartial<SubgraphInput>({}),
        node,
        node.inputs[0],
        undefined
      )
    ).toThrow('Invalid slot indices.')
  })

  it('creates links via connectSlots, preferring the input type', () => {
    const subgraph = createIoSubgraph()
    const node = addInnerNode(subgraph)

    const link = subgraph.inputNode.connectSlots(
      subgraph.inputs[0],
      node,
      node.inputs[0],
      undefined
    )

    expect(link.type).toBe('STRING')
    expect(String(link.origin_id)).toBe(String(subgraph.inputNode.id))
  })

  it('falls back to the subgraph slot type for untyped inputs', () => {
    const subgraph = createIoSubgraph()
    const node = new LGraphNode('Untyped')
    node.addInput('in', '')
    subgraph.add(node)

    const link = subgraph.inputNode.connectSlots(
      subgraph.inputs[0],
      node,
      node.inputs[0],
      undefined
    )

    expect(link.type).toBe('STRING')
  })

  it('connects an existing slot directly via connectByType', () => {
    const subgraph = createIoSubgraph()
    const node = addInnerNode(subgraph)

    const link = subgraph.inputNode.connectByType(0, node, 'STRING')

    expect(link).toBeDefined()
    expect(subgraph.inputs[0].linkIds).toEqual([link?.id])
  })

  it('returns undefined from connectByType when no input matches', () => {
    const subgraph = createIoSubgraph()
    const node = new LGraphNode('No Inputs')

    expect(subgraph.inputNode.connectByType(0, node, 'STRING')).toBeUndefined()
  })

  it('finds output slots by name and type', () => {
    const subgraph = createIoSubgraph()

    expect(subgraph.inputNode.findOutputSlot('in')).toBe(subgraph.inputs[0])
    expect(subgraph.inputNode.findOutputSlot('nope')).toBeUndefined()
    expect(subgraph.inputNode.findOutputByType('STRING')).toBe(
      subgraph.inputs[0]
    )
  })

  describe('_disconnectNodeInput corruption handling', () => {
    it('clears the input without a link', () => {
      const subgraph = createIoSubgraph()
      const node = addInnerNode(subgraph)
      subgraph.inputs[0].connect(node.inputs[0], node)

      subgraph.inputNode._disconnectNodeInput(node, node.inputs[0], undefined)

      expect(node.inputs[0].link).toBeNull()
    })

    it('warns when the link references a missing subgraph input slot', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const subgraph = createIoSubgraph()
      const node = addInnerNode(subgraph)
      const link = subgraph.inputs[0].connect(node.inputs[0], node)
      if (!link) throw new Error('Failed to connect')

      // Characterises corruption handling: link points at a nonexistent slot.
      link.origin_slot = 99
      subgraph.inputNode._disconnectNodeInput(node, node.inputs[0], link)

      expect(warn).toHaveBeenCalledWith(
        'disconnectNodeInput: subgraphInput not found',
        subgraph.inputNode,
        99
      )
    })

    it('warns when the slot does not list the link id', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const subgraph = createIoSubgraph()
      const node = addInnerNode(subgraph)
      const link = subgraph.inputs[0].connect(node.inputs[0], node)
      if (!link) throw new Error('Failed to connect')

      // Characterises corruption handling: the slot lost its link id.
      subgraph.inputs[0].linkIds.length = 0
      subgraph.inputNode._disconnectNodeInput(node, node.inputs[0], link)

      expect(warn).toHaveBeenCalledWith(
        'disconnectNodeInput: link ID not found in subgraphInput linkIds',
        link.id
      )
    })

    it('skips connection callbacks for foreign inputs', () => {
      const subgraph = createIoSubgraph()
      const node = addInnerNode(subgraph)
      const onConnectionsChange = vi.fn()
      node.onConnectionsChange = onConnectionsChange
      const link = subgraph.inputs[0].connect(node.inputs[0], node)
      if (!link) throw new Error('Failed to connect')

      const foreignInput = fromPartial<INodeInputSlot>({
        name: 'foreign',
        type: 'STRING',
        link: null,
        boundingRect: [0, 0, 0, 0]
      })
      subgraph.inputNode._disconnectNodeInput(node, foreignInput, link)

      expect(onConnectionsChange).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        false,
        expect.anything(),
        expect.anything()
      )
    })
  })
})
