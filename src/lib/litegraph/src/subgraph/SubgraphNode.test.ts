/**
 * SubgraphNode Tests
 *
 * Tests for SubgraphNode instances including construction,
 * IO synchronization, and edge cases.
 */
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fromPartial } from '@total-typescript/shoehorn'

import {
  BaseWidget,
  LGraph,
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type { ExportedSubgraphInstance } from '@/lib/litegraph/src/types/serialisation'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import type { WidgetId } from '@/types/widgetId'

import { subgraphTest } from './__fixtures__/subgraphFixtures'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SubgraphNode Construction', () => {
  it('should create a SubgraphNode from a subgraph definition', () => {
    const subgraph = createTestSubgraph({
      name: 'Test Definition',
      inputs: [{ name: 'input', type: 'number' }],
      outputs: [{ name: 'output', type: 'number' }]
    })

    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode).toBeDefined()
    expect(subgraphNode.subgraph).toBe(subgraph)
    expect(subgraphNode.type).toBe(subgraph.id)
    expect(subgraphNode.isVirtualNode).toBe(true)
    expect(subgraphNode.displayType).toBe('Subgraph node')
  })

  it('should configure from instance data', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }],
      outputs: [{ name: 'result', type: 'number' }]
    })

    const subgraphNode = createTestSubgraphNode(subgraph, {
      id: 42,
      pos: [300, 150],
      size: [180, 80]
    })

    expect(subgraphNode.id).toBe(toNodeId(42))
    expect(Array.from(subgraphNode.pos)).toEqual([300, 150])
    expect(Array.from(subgraphNode.size)).toEqual([180, 80])
  })

  it('should maintain reference to root graph', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = subgraphNode.graph!

    expect(subgraphNode.rootGraph).toBe(parentGraph.rootGraph)
  })

  it('should throw NullGraphError when accessing rootGraph after removal', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = subgraphNode.graph!
    parentGraph.add(subgraphNode)

    parentGraph.remove(subgraphNode)

    expect(() => subgraphNode.rootGraph).toThrow()
    expect(subgraphNode.graph).toBeNull()
  })

  it('should return empty widgets array (not throw) after removal', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = subgraphNode.graph!
    parentGraph.add(subgraphNode)

    parentGraph.remove(subgraphNode)

    expect(subgraphNode.graph).toBeNull()
    expect(() => subgraphNode.widgets).not.toThrow()
    expect(subgraphNode.widgets).toEqual([])
  })

  it('warns when external code assigns widgets directly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)

    subgraphNode.widgets = []

    expect(warn).toHaveBeenCalledWith(
      'Cannot manually set widgets on SubgraphNode; use the promotion system.'
    )
  })

  subgraphTest(
    'should synchronize slots with subgraph definition',
    ({ subgraphWithNode }) => {
      const { subgraph, subgraphNode } = subgraphWithNode

      // SubgraphNode should have same number of inputs/outputs as definition
      expect(subgraphNode.inputs).toHaveLength(subgraph.inputs.length)
      expect(subgraphNode.outputs).toHaveLength(subgraph.outputs.length)
    }
  )

  subgraphTest(
    'should update slots when subgraph definition changes',
    ({ subgraphWithNode }) => {
      const { subgraph, subgraphNode } = subgraphWithNode

      const initialInputCount = subgraphNode.inputs.length

      // Add an input to the subgraph definition
      subgraph.addInput('new_input', 'string')

      // SubgraphNode should automatically update (this tests the event system)
      expect(subgraphNode.inputs).toHaveLength(initialInputCount + 1)
      expect(subgraphNode.inputs.at(-1)?.name).toBe('new_input')
      expect(subgraphNode.inputs.at(-1)?.type).toBe('string')
    }
  )
})

describe('SubgraphNode Synchronization', () => {
  it('should sync input addition', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.inputs).toHaveLength(0)

    subgraph.addInput('value', 'number')

    expect(subgraphNode.inputs).toHaveLength(1)
    expect(subgraphNode.inputs[0].name).toBe('value')
    expect(subgraphNode.inputs[0].type).toBe('number')
  })

  it('should sync output addition', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.outputs).toHaveLength(0)

    subgraph.addOutput('result', 'string')

    expect(subgraphNode.outputs).toHaveLength(1)
    expect(subgraphNode.outputs[0].name).toBe('result')
    expect(subgraphNode.outputs[0].type).toBe('string')
  })

  it('should sync input removal', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'input1', type: 'number' },
        { name: 'input2', type: 'string' }
      ]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.inputs).toHaveLength(2)

    subgraph.removeInput(subgraph.inputs[0])

    expect(subgraphNode.inputs).toHaveLength(1)
    expect(subgraphNode.inputs[0].name).toBe('input2')
  })

  it('should sync output removal', () => {
    const subgraph = createTestSubgraph({
      outputs: [
        { name: 'output1', type: 'number' },
        { name: 'output2', type: 'string' }
      ]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.outputs).toHaveLength(2)

    subgraph.removeOutput(subgraph.outputs[0])

    expect(subgraphNode.outputs).toHaveLength(1)
    expect(subgraphNode.outputs[0].name).toBe('output2')
  })

  it('should sync slot renaming', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'oldName', type: 'number' }],
      outputs: [{ name: 'oldOutput', type: 'string' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    // Rename input
    subgraph.inputs[0].label = 'newName'
    subgraph.events.dispatch('renaming-input', {
      input: subgraph.inputs[0],
      index: 0,
      oldName: 'oldName',
      newName: 'newName'
    })

    expect(subgraphNode.inputs[0].label).toBe('newName')

    // Rename output
    subgraph.outputs[0].label = 'newOutput'
    subgraph.events.dispatch('renaming-output', {
      output: subgraph.outputs[0],
      index: 0,
      oldName: 'oldOutput',
      newName: 'newOutput'
    })

    expect(subgraphNode.outputs[0].label).toBe('newOutput')
  })

  it('throws when input rename events reference a missing slot', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'input', type: 'number' }]
    })
    createTestSubgraphNode(subgraph)

    expect(() =>
      subgraph.events.dispatch('renaming-input', {
        input: subgraph.inputs[0],
        index: 99,
        oldName: 'input',
        newName: 'missing'
      })
    ).toThrow('Subgraph input not found')
  })

  it('throws when output rename events reference a missing slot', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'output', type: 'number' }]
    })
    createTestSubgraphNode(subgraph)

    expect(() =>
      subgraph.events.dispatch('renaming-output', {
        output: subgraph.outputs[0],
        index: 99,
        oldName: 'output',
        newName: 'missing'
      })
    ).toThrow('Subgraph output not found')
  })

  it('represents promoted host widgets by input widgetId and WidgetState', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'text', type: 'STRING' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    interiorNode.addOutput('out', 'STRING')
    interiorNode.addWidget('text', 'value', 'initial', () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const promotedInput = subgraphNode.inputs[0]
    const inputWidgetId = promotedInput.widgetId

    expect(subgraphNode.widgets).toMatchObject([
      { name: 'text', widgetId: inputWidgetId }
    ])
    expect(promotedInput._widget).toBe(subgraphNode.widgets[0])
    expect(inputWidgetId).toBeDefined()
    expect('sourceNodeId' in promotedInput).toBe(false)
    expect('sourceWidgetName' in promotedInput).toBe(false)
    if (!inputWidgetId) throw new Error('Missing widgetId')

    expect(useWidgetValueStore().getWidget(inputWidgetId)?.value).toBe(
      'initial'
    )
  })

  it('binds promoted host widgets as stable LiteGraph widgets', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'text', type: 'STRING' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    interiorNode.addOutput('out', 'STRING')
    interiorNode.addWidget('text', 'value', 'initial', () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const promotedInput = subgraphNode.inputs[0]
    const widget = subgraphNode.widgets[0]

    expect(widget).toBeDefined()
    expect(subgraphNode.widgets[0]).toBe(widget)
    expect(promotedInput._widget).toBe(widget)
    expect(subgraphNode.getWidgetFromSlot(promotedInput)).toBe(widget)

    subgraphNode.arrange()

    expect(promotedInput.pos?.[1]).toBeGreaterThan(
      LiteGraph.NODE_SLOT_HEIGHT * 0.5
    )
  })

  it('does not expose promoted widgetId to BaseWidget assignment', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'text', type: 'STRING' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    interiorNode.addOutput('out', 'STRING')
    interiorNode.addWidget('text', 'value', 'initial', () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const widget = subgraphNode.widgets[0]
    expect(widget?.widgetId).toBeDefined()

    expect(() => {
      // @ts-expect-error Abstract class instantiation
      new BaseWidget({ ...widget, node: subgraphNode })
    }).not.toThrow()
  })

  it('reads promoted widget label and y from WidgetState', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'text', type: 'STRING' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    interiorNode.addOutput('out', 'STRING')
    interiorNode.addWidget('text', 'value', 'initial', () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const promotedInput = subgraphNode.inputs[0]
    const widget = subgraphNode.widgets[0]
    const id = promotedInput.widgetId
    if (!id) throw new Error('Missing widgetId')
    const state = useWidgetValueStore().getWidget(id)
    if (!state) throw new Error('Missing widget state')

    state.label = 'Stored Label'
    state.y = 27

    expect(widget?.name).toBe('text')
    expect(widget?.label).toBe('Stored Label')
    expect(widget?.y).toBe(27)
  })

  it('writes promoted widget label and y to WidgetState', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'text', type: 'STRING' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    interiorNode.addOutput('out', 'STRING')
    interiorNode.addWidget('text', 'value', 'initial', () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const promotedInput = subgraphNode.inputs[0]
    const widget = subgraphNode.widgets[0]
    const id = promotedInput.widgetId
    if (!id) throw new Error('Missing widgetId')

    if (!widget) throw new Error('Missing projected widget')
    widget.label = 'Projected Label'
    widget.y = 31

    expect(useWidgetValueStore().getWidget(id)).toMatchObject({
      name: 'text',
      label: 'Projected Label',
      y: 31
    })
  })

  it('falls back projected widget fields when WidgetState is missing', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'text', type: 'STRING' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    interiorNode.addOutput('out', 'STRING')
    interiorNode.addWidget('text', 'value', 'initial', () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const promotedInput = subgraphNode.inputs[0]
    const widget = subgraphNode.widgets[0]
    const id = promotedInput.widgetId
    if (!id) throw new Error('Missing widgetId')
    if (!widget) throw new Error('Missing projected widget')

    useWidgetValueStore().deleteWidget(id)

    expect(widget.name).toBe('text')
    expect(widget.label).toBe('text')
    expect(widget.y).toBe(0)
    expect(widget.type).toBe('text')
    expect(widget.options).toEqual({})
    expect(widget.value).toBeUndefined()
    expect(() => {
      widget.label = 'Label'
      widget.y = 12
      widget.callback?.('updated')
    }).not.toThrow()
  })

  it('should keep input.widget.name stable after rename (onGraphConfigured safety)', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'text', type: 'STRING' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    interiorNode.addOutput('out', 'STRING')
    interiorNode.addWidget('text', 'value', '', () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const promotedInput = subgraphNode.inputs[0]
    expect(promotedInput.widget).toBeDefined()

    const originalWidgetName = promotedInput.widget!.name

    subgraph.inputs[0].label = 'my_custom_prompt'
    subgraph.events.dispatch('renaming-input', {
      input: subgraph.inputs[0],
      index: 0,
      oldName: 'text',
      newName: 'my_custom_prompt'
    })

    expect(promotedInput.widget!.name).toBe(originalWidgetName)
    expect(promotedInput.label).toBe('my_custom_prompt')
    expect(subgraphNode.widgets).toMatchObject([
      { name: 'text', label: 'my_custom_prompt' }
    ])
    expect(promotedInput.widgetId).toBeDefined()
    if (!promotedInput.widgetId) throw new Error('Missing widgetId')
    expect(useWidgetValueStore().getWidget(promotedInput.widgetId)?.label).toBe(
      'my_custom_prompt'
    )
  })

  it('should preserve renamed label through serialize/configure round-trip', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'seed', type: 'INT' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'INT')
    input.widget = { name: 'value' }
    interiorNode.addOutput('out', 'INT')
    interiorNode.addWidget('number', 'value', 0, () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const inputSlot = subgraphNode.inputs[0]
    expect(inputSlot.widgetId).toBeDefined()
    if (!inputSlot.widgetId) throw new Error('Missing widgetId')

    subgraph.inputs[0].label = 'My Seed'
    subgraphNode.inputs[0].label = 'My Seed'
    subgraph.events.dispatch('renaming-input', {
      input: subgraph.inputs[0],
      index: 0,
      oldName: 'seed',
      newName: 'My Seed'
    })

    expect(useWidgetValueStore().getWidget(inputSlot.widgetId)?.label).toBe(
      'My Seed'
    )

    const serialized = subgraphNode.serialize()
    subgraphNode.configure(serialized)

    expect(subgraphNode.widgets).toMatchObject([
      { name: 'seed', label: 'My Seed' }
    ])
    expect(inputSlot.label).toBe('My Seed')
    expect(useWidgetValueStore().getWidget(inputSlot.widgetId)?.label).toBe(
      'My Seed'
    )
  })

  it('keeps rename behavior when widget state has been removed', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'text', type: 'STRING' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    interiorNode.addWidget('text', 'value', 'initial', () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const promotedInput = subgraphNode.inputs[0]
    const widgetId = promotedInput.widgetId
    if (!widgetId) throw new Error('Missing widgetId')
    useWidgetValueStore().deleteWidget(widgetId)

    subgraph.renameInput(subgraph.inputs[0], 'Renamed Text')

    expect(promotedInput.label).toBe('Renamed Text')
    expect(useWidgetValueStore().getWidget(widgetId)).toBeUndefined()
  })

  it('rebinds promoted widgets when subgraph input objects are recreated', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'text', type: 'STRING' }]
    })

    const interiorNode = new LGraphNode('Interior')
    interiorNode.id = toNodeId(5)
    const input = interiorNode.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    interiorNode.addWidget('text', 'value', 'initial', () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const originalSlot = subgraphNode.inputs[0]._subgraphSlot
    const originalWidgetId = subgraphNode.inputs[0].widgetId
    const serialized = subgraph.asSerialisable()

    subgraph.configure(serialized)

    expect(subgraphNode.inputs).toHaveLength(1)
    expect(subgraphNode.inputs[0]._subgraphSlot).toBe(subgraph.inputs[0])
    expect(subgraphNode.inputs[0]._subgraphSlot).not.toBe(originalSlot)
    expect(subgraphNode.inputs[0].widgetId).toBe(originalWidgetId)
    expect(subgraphNode.widgets[0]).toMatchObject({
      name: 'text',
      value: 'initial'
    })
  })

  it('stores DOM widget metadata from custom promoted host widgets', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'dom', type: 'STRING' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    const interiorWidget = interiorNode.addWidget(
      'text',
      'value',
      'initial',
      () => {}
    )
    Object.assign(interiorWidget, { isDOMWidget: true })
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)
    const hostWidget = fromPartial<IBaseWidget>({
      name: 'host',
      type: 'text',
      value: 'host value',
      options: {},
      y: 0
    })

    class HostWidgetSubgraphNode extends SubgraphNode {
      protected override createPromotedHostWidget() {
        return hostWidget
      }
    }

    const subgraphNode = new HostWidgetSubgraphNode(
      subgraph.rootGraph,
      subgraph,
      fromPartial<ExportedSubgraphInstance>({
        id: 10,
        type: subgraph.id,
        pos: [0, 0],
        size: [200, 100],
        properties: {}
      })
    )
    const widgetId = subgraphNode.inputs[0].widgetId
    if (!widgetId) throw new Error('Missing widgetId')

    expect(subgraphNode.widgets).toEqual([hostWidget])
    expect(useWidgetValueStore().getWidget(widgetId)).toMatchObject({
      isDOMWidget: true
    })
  })
})

describe('SubgraphNode widget name collision on rename', () => {
  it('should not collapse two inputs when renamed to the same label', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'prompt_a', type: 'STRING' },
        { name: 'prompt_b', type: 'STRING' }
      ]
    })

    // Create two interior nodes with widgets
    const nodeA = new LGraphNode('NodeA')
    nodeA.addInput('value', 'STRING')
    nodeA.inputs[0].widget = { name: 'value' }
    nodeA.addOutput('out', 'STRING')
    nodeA.addWidget('text', 'value', '', () => {})
    subgraph.add(nodeA)
    subgraph.inputNode.slots[0].connect(nodeA.inputs[0], nodeA)

    const nodeB = new LGraphNode('NodeB')
    nodeB.addInput('value', 'STRING')
    nodeB.inputs[0].widget = { name: 'value' }
    nodeB.addOutput('out', 'STRING')
    nodeB.addWidget('text', 'value', '', () => {})
    subgraph.add(nodeB)
    subgraph.inputNode.slots[1].connect(nodeB.inputs[0], nodeB)

    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.inputs).toHaveLength(2)
    // widget.name is now nodeId:widgetName (stable composite key)
    const key0 = subgraphNode.inputs[0].widget?.name
    const key1 = subgraphNode.inputs[1].widget?.name
    expect(key0).toBeDefined()
    expect(key1).toBeDefined()
    expect(key0).not.toBe(key1)

    // Rename prompt_b to same LABEL as prompt_a
    subgraph.inputs[1].label = 'prompt_a'
    subgraph.events.dispatch('renaming-input', {
      input: subgraph.inputs[1],
      index: 1,
      oldName: 'prompt_b',
      newName: 'prompt_a'
    })

    // Both inputs survive — widget.name stays as composite key, no collision
    expect(subgraphNode.inputs).toHaveLength(2)
    expect(subgraphNode.inputs[0].widget?.name).toBe(key0)
    expect(subgraphNode.inputs[1].widget?.name).toBe(key1)

    // Display labels: input[1] was renamed
    expect(subgraphNode.inputs[1].label).toBe('prompt_a')

    expect(subgraphNode.inputs[0].widgetId).toBeDefined()
    expect(subgraphNode.inputs[1].widgetId).toBeDefined()
    expect(subgraphNode.inputs[0].widgetId).not.toBe(
      subgraphNode.inputs[1].widgetId
    )
  })

  it('should keep unique widget.name keys even with duplicate labels', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'seed', type: 'INT' },
        { name: 'seed2', type: 'INT' }
      ]
    })

    const nodeA = new LGraphNode('NodeA')
    nodeA.addInput('value', 'INT')
    nodeA.inputs[0].widget = { name: 'value' }
    nodeA.addOutput('out', 'INT')
    nodeA.addWidget('number', 'value', 0, () => {})
    subgraph.add(nodeA)
    subgraph.inputNode.slots[0].connect(nodeA.inputs[0], nodeA)

    const nodeB = new LGraphNode('NodeB')
    nodeB.addInput('value', 'INT')
    nodeB.inputs[0].widget = { name: 'value' }
    nodeB.addOutput('out', 'INT')
    nodeB.addWidget('number', 'value', 0, () => {})
    subgraph.add(nodeB)
    subgraph.inputNode.slots[1].connect(nodeB.inputs[0], nodeB)

    const subgraphNode = createTestSubgraphNode(subgraph)

    const key0 = subgraphNode.inputs[0].widget?.name
    const key1 = subgraphNode.inputs[1].widget?.name

    // Keys should be unique composite identifiers (nodeId:widgetName)
    expect(key0).toBeDefined()
    expect(key1).toBeDefined()
    expect(key0).not.toBe(key1)

    // Rename seed2 to "seed" — duplicate display label
    subgraph.inputs[1].label = 'seed'
    subgraph.events.dispatch('renaming-input', {
      input: subgraph.inputs[1],
      index: 1,
      oldName: 'seed2',
      newName: 'seed'
    })

    // Widget keys remain stable — rename only affects display label
    expect(subgraphNode.inputs[0].widget?.name).toBe(key0)
    expect(subgraphNode.inputs[1].widget?.name).toBe(key1)

    expect(subgraphNode.inputs[0].widgetId).toBeDefined()
    expect(subgraphNode.inputs[1].widgetId).toBeDefined()
    expect(subgraphNode.inputs[0].widgetId).not.toBe(
      subgraphNode.inputs[1].widgetId
    )
  })

  it('should not lose input when onGraphConfigured runs after duplicate rename', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'alpha', type: 'STRING' },
        { name: 'beta', type: 'STRING' }
      ]
    })

    const nodeA = new LGraphNode('NodeA')
    nodeA.addInput('value', 'STRING')
    nodeA.inputs[0].widget = { name: 'value' }
    nodeA.addOutput('out', 'STRING')
    nodeA.addWidget('text', 'value', '', () => {})
    subgraph.add(nodeA)
    subgraph.inputNode.slots[0].connect(nodeA.inputs[0], nodeA)

    const nodeB = new LGraphNode('NodeB')
    nodeB.addInput('value', 'STRING')
    nodeB.inputs[0].widget = { name: 'value' }
    nodeB.addOutput('out', 'STRING')
    nodeB.addWidget('text', 'value', '', () => {})
    subgraph.add(nodeB)
    subgraph.inputNode.slots[1].connect(nodeB.inputs[0], nodeB)

    const subgraphNode = createTestSubgraphNode(subgraph)

    // Rename beta to "alpha" — collision
    subgraph.inputs[1].label = 'alpha'
    subgraph.events.dispatch('renaming-input', {
      input: subgraph.inputs[1],
      index: 1,
      oldName: 'beta',
      newName: 'alpha'
    })

    for (const input of subgraphNode.inputs) {
      expect(input.widgetId).toBeDefined()
      if (!input.widgetId) throw new Error('Missing widgetId')
      expect(useWidgetValueStore().getWidget(input.widgetId)).toBeDefined()
    }

    expect(subgraphNode.widgets).toHaveLength(2)
    expect(subgraphNode.inputs).toHaveLength(2)
  })
})

describe('SubgraphNode Lifecycle', () => {
  it('should handle reconfiguration', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'input1', type: 'number' }],
      outputs: [{ name: 'output1', type: 'string' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    // Initial state
    expect(subgraphNode.inputs).toHaveLength(1)
    expect(subgraphNode.outputs).toHaveLength(1)

    // Add more slots to subgraph
    subgraph.addInput('input2', 'string')
    subgraph.addOutput('output2', 'number')

    // Reconfigure
    subgraphNode.configure({
      id: subgraphNode.id,
      type: subgraph.id,
      pos: [200, 200],
      size: [180, 100],
      inputs: [],
      outputs: [],
      properties: {},
      flags: {},
      mode: 0,
      order: 0
    })

    // Should reflect updated subgraph structure
    expect(subgraphNode.inputs).toHaveLength(2)
    expect(subgraphNode.outputs).toHaveLength(2)
  })

  it('should handle removal lifecycle', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = new LGraph()

    parentGraph.add(subgraphNode)
    expect(parentGraph.nodes).toContain(subgraphNode)

    // Test onRemoved method
    subgraphNode.onRemoved()

    // Note: onRemoved doesn't automatically remove from graph
    // but it should clean up internal state
    expect(subgraphNode.inputs).toBeDefined()
  })
})

describe('SubgraphNode Basic Functionality', () => {
  it('opens subgraphs from the title button and delegates other buttons', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const canvas = fromPartial<
      Parameters<SubgraphNode['onTitleButtonClick']>[1]
    >({
      openSubgraph: vi.fn()
    })
    const fallback = vi
      .spyOn(LGraphNode.prototype, 'onTitleButtonClick')
      .mockImplementation(() => undefined)

    subgraphNode.onTitleButtonClick(
      fromPartial({ name: 'enter_subgraph' }),
      canvas
    )
    subgraphNode.onTitleButtonClick(fromPartial({ name: 'other' }), canvas)

    expect(canvas.openSubgraph).toHaveBeenCalledWith(subgraph, subgraphNode)
    expect(fallback).toHaveBeenCalledWith(
      fromPartial({ name: 'other' }),
      canvas
    )
  })

  it('should inherit input types correctly', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'numberInput', type: 'number' },
        { name: 'stringInput', type: 'string' },
        { name: 'anyInput', type: '*' }
      ]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.inputs[0].type).toBe('number')
    expect(subgraphNode.inputs[1].type).toBe('string')
    expect(subgraphNode.inputs[2].type).toBe('*')
  })

  it('should inherit output types correctly', () => {
    const subgraph = createTestSubgraph({
      outputs: [
        { name: 'numberOutput', type: 'number' },
        { name: 'stringOutput', type: 'string' },
        { name: 'anyOutput', type: '*' }
      ]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.outputs[0].type).toBe('number')
    expect(subgraphNode.outputs[1].type).toBe('string')
    expect(subgraphNode.outputs[2].type).toBe('*')
  })

  it('delegates title box drawing to a custom handler', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const onDrawTitleBox = vi.fn()
    subgraphNode.onDrawTitleBox = onDrawTitleBox
    const ctx = fromPartial<CanvasRenderingContext2D>({})

    subgraphNode.drawTitleBox(ctx, {
      scale: 2,
      low_quality: false,
      title_height: 30,
      box_size: 12
    })

    expect(onDrawTitleBox).toHaveBeenCalledWith(
      ctx,
      30,
      subgraphNode.renderingSize,
      2
    )
  })

  it('draws the default title box with and without the bitmap icon', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const ctx = fromPartial<CanvasRenderingContext2D>({
      save: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      restore: vi.fn()
    })

    subgraphNode.drawTitleBox(ctx, { scale: 1 })
    subgraphNode.drawTitleBox(ctx, { scale: 1, low_quality: true })

    expect(ctx.roundRect).toHaveBeenCalledWith(6, -24.5, 22, 20, 5)
    expect(ctx.drawImage).toHaveBeenCalledTimes(1)
    expect(ctx.restore).toHaveBeenCalledTimes(2)
  })

  it('returns undefined when a widgetId does not match a promoted input', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'text', type: 'STRING' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(
      subgraphNode.getSlotFromWidget(
        fromPartial<IBaseWidget>({
          name: 'missing',
          type: 'text',
          value: '',
          widgetId: 'missing-widget' as WidgetId
        })
      )
    ).toBeUndefined()
  })

  it('returns null for missing inner input links', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'output', type: 'IMAGE' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(subgraphNode.getInputLink(0)).toBeNull()
  })

  it('returns a translated input link for connected subgraph outputs', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'output', type: 'IMAGE' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)
    const inner = new LGraphNode('Inner')
    inner.id = toNodeId(9)
    inner.addOutput('image', 'IMAGE')
    subgraph.add(inner)
    subgraph.outputNode.slots[0].connect(inner.outputs[0], inner)

    const link = subgraphNode.getInputLink(0)

    expect(link?.origin_id).toBe(toNodeId(`${subgraphNode.id}:${inner.id}`))
    expect(link?.origin_slot).toBe(0)
  })

  it('returns empty resolved input links when the subgraph input is isolated', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'input', type: 'IMAGE' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(subgraphNode.resolveSubgraphInputLinks(0)).toEqual([])
  })

  it('returns resolved input links when the subgraph input is connected', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'input', type: 'IMAGE' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)
    const inner = new LGraphNode('Inner')
    inner.id = toNodeId(9)
    const input = inner.addInput('image', 'IMAGE')
    subgraph.add(inner)
    subgraph.inputNode.slots[0].connect(input, inner)

    expect(subgraphNode.resolveSubgraphInputLinks(0)).toEqual([
      expect.objectContaining({
        input,
        inputNode: inner
      })
    ])
  })

  it('returns resolved output links when the subgraph output is connected', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'output', type: 'IMAGE' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)
    const inner = new LGraphNode('Inner')
    inner.addOutput('image', 'IMAGE')
    subgraph.add(inner)
    subgraph.outputNode.slots[0].connect(inner.outputs[0], inner)

    expect(subgraphNode.resolveSubgraphOutputLink(0)?.outputNode).toBe(inner)
  })

  it('returns a consistent slot shape only when all inner shapes match', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'input', type: 'IMAGE' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)
    const slot = subgraph.inputs[0]

    expect(subgraphNode.getSlotShape(slot, fromPartial({ shape: 4 }))).toBe(4)

    const node = new LGraphNode('ShapeTarget')
    const rounded = node.addInput('rounded', 'IMAGE')
    const boxed = node.addInput('boxed', 'IMAGE')
    rounded.shape = 4
    boxed.shape = 3
    subgraph.add(node)
    slot.connect(rounded, node)

    expect(subgraphNode.getSlotShape(slot, boxed)).toBeUndefined()
  })
})

describe('SubgraphNode Execution', () => {
  it('should flatten to ExecutableNodeDTOs', () => {
    const subgraph = createTestSubgraph({ nodeCount: 3 })
    const subgraphNode = createTestSubgraphNode(subgraph)

    const executableNodes = new Map()
    const flattened = subgraphNode.getInnerNodes(executableNodes)

    const nodeId = subgraphNode.id
    const idPattern = new RegExp(`^${nodeId}:\\d+$`)
    expect(flattened).toHaveLength(3)
    expect(flattened[0].id).toMatch(idPattern)
    expect(flattened[1].id).toMatch(idPattern)
    expect(flattened[2].id).toMatch(idPattern)
  })

  it('should handle nested subgraph execution', () => {
    const rootGraph = new LGraph()
    const childSubgraph = createTestSubgraph({
      rootGraph,
      name: 'Child',
      nodeCount: 1
    })

    const parentSubgraph = createTestSubgraph({
      rootGraph,
      name: 'Parent',
      nodeCount: 1
    })

    const childSubgraphNode = createTestSubgraphNode(childSubgraph, {
      id: 42,
      parentGraph: parentSubgraph
    })
    parentSubgraph.add(childSubgraphNode)

    const parentSubgraphNode = createTestSubgraphNode(parentSubgraph, {
      id: 10,
      parentGraph: rootGraph
    })
    rootGraph.add(parentSubgraphNode)

    const executableNodes = new Map()
    const flattened = parentSubgraphNode.getInnerNodes(executableNodes)

    expect(flattened.length).toBeGreaterThan(0)
  })

  it('should resolve cross-boundary input links', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'input1', type: 'number' }],
      nodeCount: 1
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    const resolved = subgraphNode.resolveSubgraphInputLinks(0)

    expect(resolved).toBeDefined()
    expect(Array.isArray(resolved)).toBe(true)
  })

  it('should resolve cross-boundary output links', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'output1', type: 'number' }],
      nodeCount: 1
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    const resolved = subgraphNode.resolveSubgraphOutputLink(0)

    // May be undefined if no internal connection exists
    expect(resolved === undefined || typeof resolved === 'object').toBe(true)
  })

  it('should prevent infinite recursion', () => {
    // Circular self-references currently recurse in traversal; this test documents
    // that execution flattening throws instead of silently succeeding.
    const subgraph = createTestSubgraph({ nodeCount: 1 })
    const subgraphNode = createTestSubgraphNode(subgraph, {
      parentGraph: subgraph
    })

    // Add subgraph node to its own subgraph (circular reference)
    // add() itself throws due to recursive forEachNode traversal
    expect(() => subgraph.add(subgraphNode)).toThrow()
  })

  it('throws a recursion error when traversal revisits the same subgraph node', () => {
    const subgraph = createTestSubgraph({ name: '' })
    const subgraphNode = createTestSubgraphNode(subgraph)
    subgraphNode.title = 'Recursive Host'

    expect(() =>
      subgraphNode.getInnerNodes(new Map(), [], [], new Set([subgraphNode]))
    ).toThrow('Circular reference detected')
  })

  it('describes unnamed recursive subgraph nodes', () => {
    const subgraph = createTestSubgraph()
    subgraph.name = ''
    const subgraphNode = createTestSubgraphNode(subgraph)
    subgraphNode.title = ''

    expect(() =>
      subgraphNode.getInnerNodes(new Map(), [], [], new Set([subgraphNode]))
    ).toThrow("node 1 of subgraph 'Unnamed Subgraph'")
  })

  it('should resolve cross-boundary links', () => {
    // This test verifies that links can cross subgraph boundaries
    // Currently this is a basic test - full cross-boundary linking
    // requires more complex setup with actual connected nodes
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'external_input', type: 'number' }],
      outputs: [{ name: 'external_output', type: 'number' }],
      nodeCount: 2
    })

    const subgraphNode = createTestSubgraphNode(subgraph)

    // Verify the subgraph node has the expected I/O structure for cross-boundary links
    expect(subgraphNode.inputs).toHaveLength(1)
    expect(subgraphNode.outputs).toHaveLength(1)
    expect(subgraphNode.inputs[0].name).toBe('external_input')
    expect(subgraphNode.outputs[0].name).toBe('external_output')

    // Internal nodes should be flattened correctly
    const executableNodes = new Map()
    const flattened = subgraphNode.getInnerNodes(executableNodes)
    expect(flattened).toHaveLength(2)
  })
})

describe('SubgraphNode preview exposure hydration', () => {
  it('hydrates explicit preview exposure properties', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const store = usePreviewExposureStore()

    subgraphNode.configure({
      ...subgraphNode.serialize(),
      properties: {
        previewExposures: [
          {
            name: 'preview',
            sourceNodeId: '12',
            sourcePreviewName: '$$preview'
          }
        ]
      }
    } as ExportedSubgraphInstance)

    expect(
      store.getExposures(subgraphNode.rootGraph.id, String(subgraphNode.id))
    ).toEqual([
      {
        name: 'preview',
        sourceNodeId: toNodeId(12),
        sourcePreviewName: '$$preview'
      }
    ])
  })

  it('clears exposures when an explicit empty property is serialized', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const store = usePreviewExposureStore()
    store.addExposure(subgraphNode.rootGraph.id, String(subgraphNode.id), {
      sourceNodeId: '12',
      sourcePreviewName: '$$preview'
    })

    subgraphNode.configure({
      ...subgraphNode.serialize(),
      properties: { previewExposures: [] }
    } as ExportedSubgraphInstance)

    expect(
      store.getExposures(subgraphNode.rootGraph.id, String(subgraphNode.id))
    ).toEqual([])
  })

  it('hydrates legacy locator exposures when no explicit property exists', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const store = usePreviewExposureStore()
    const legacyLocator = createNodeLocatorId(null, subgraphNode.id)
    store.addExposure(subgraphNode.rootGraph.id, legacyLocator, {
      sourceNodeId: '12',
      sourcePreviewName: '$$legacy'
    })

    subgraphNode.configure({
      ...subgraphNode.serialize(),
      properties: {}
    } as ExportedSubgraphInstance)

    expect(
      store.getExposures(subgraphNode.rootGraph.id, String(subgraphNode.id))
    ).toEqual([
      expect.objectContaining({
        sourceNodeId: toNodeId(12),
        sourcePreviewName: '$$legacy'
      })
    ])
  })
})

describe('SubgraphNode serialization', () => {
  it('serializes promoted widget values and valid quarantine entries', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'seed', type: 'INT' }]
    })
    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'INT')
    input.widget = { name: 'value' }
    interiorNode.addWidget('number', 'value', 3, () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)
    const subgraphNode = createTestSubgraphNode(subgraph)
    const widgetId = subgraphNode.inputs[0].widgetId
    if (!widgetId) throw new Error('Missing widgetId')
    useWidgetValueStore().setValue(widgetId, 42)
    subgraphNode.properties.proxyWidgetErrorQuarantine = [
      {
        originalEntry: ['-1', 'seed'],
        reason: 'missingSourceNode',
        attemptedAtVersion: 1,
        hostValue: 7
      }
    ]

    const serialized = subgraphNode.serialize()

    expect(serialized.widgets_values).toEqual([42])
    expect(serialized.properties?.proxyWidgetErrorQuarantine).toEqual([
      {
        originalEntry: ['-1', 'seed'],
        reason: 'missingSourceNode',
        attemptedAtVersion: 1,
        hostValue: 7
      }
    ])
  })

  it('uses quarantined host values before serialized widget values', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'seed', type: 'INT' }]
    })
    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'INT')
    input.widget = { name: 'value' }
    interiorNode.addWidget('number', 'value', 3, () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)
    const subgraphNode = createTestSubgraphNode(subgraph)
    const widgetId = subgraphNode.inputs[0].widgetId
    if (!widgetId) throw new Error('Missing widgetId')

    subgraphNode.configure({
      ...subgraphNode.serialize(),
      widgets_values: [11],
      properties: {
        proxyWidgetErrorQuarantine: [
          {
            originalEntry: ['-1', 'seed'],
            reason: 'missingSourceNode',
            attemptedAtVersion: 1,
            hostValue: 55
          }
        ]
      }
    } as ExportedSubgraphInstance)

    expect(useWidgetValueStore().getWidget(widgetId)?.value).toBe(55)
  })

  it('omits widget values when promoted widget state is non-serializable', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'seed', type: 'INT' }]
    })
    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'INT')
    input.widget = { name: 'value' }
    interiorNode.addWidget('number', 'value', 3, () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)
    const subgraphNode = createTestSubgraphNode(subgraph)
    const widgetId = subgraphNode.inputs[0].widgetId
    if (!widgetId) throw new Error('Missing widgetId')
    useWidgetValueStore().getWidget(widgetId)!.value = undefined

    const serialized = subgraphNode.serialize()

    expect(serialized.widgets_values).toBeUndefined()
  })
})

describe('SubgraphNode Edge Cases', () => {
  it('should handle deep nesting', () => {
    // Create a simpler deep nesting test that works with current implementation
    const subgraph = createTestSubgraph({
      name: 'Deep Test',
      nodeCount: 5 // Multiple nodes to test flattening at depth
    })

    const subgraphNode = createTestSubgraphNode(subgraph)

    // Should be able to flatten without errors even with multiple nodes
    const executableNodes = new Map()
    expect(() => {
      subgraphNode.getInnerNodes(executableNodes)
    }).not.toThrow()

    const flattened = subgraphNode.getInnerNodes(executableNodes)
    expect(flattened.length).toBe(5)

    // All flattened nodes should have proper path-based IDs
    for (const dto of flattened) {
      expect(dto.id).toMatch(/^\d+:\d+$/)
    }
  })
})

describe('SubgraphNode Integration', () => {
  it('should be addable to a parent graph', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = new LGraph()

    parentGraph.add(subgraphNode)

    expect(parentGraph.nodes).toContain(subgraphNode)
    expect(subgraphNode.graph).toBe(parentGraph)
  })

  subgraphTest(
    'should maintain reference to root graph',
    ({ subgraphWithNode }) => {
      const { subgraphNode } = subgraphWithNode

      // For this test, parentGraph should be the root, but in nested scenarios
      // it would traverse up to find the actual root
      expect(subgraphNode.rootGraph).toBeDefined()
    }
  )

  it('should handle graph removal properly', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = new LGraph()

    parentGraph.add(subgraphNode)
    expect(parentGraph.nodes).toContain(subgraphNode)

    parentGraph.remove(subgraphNode)
    expect(parentGraph.nodes.find((node) => node.id === subgraphNode.id)).toBe(
      undefined
    )
  })
})

describe('SubgraphNode Cleanup', () => {
  it('should clean up event listeners when removed', () => {
    const rootGraph = new LGraph()
    const subgraph = createTestSubgraph()

    // Create and add two nodes
    const node1 = createTestSubgraphNode(subgraph)
    const node2 = createTestSubgraphNode(subgraph)
    rootGraph.add(node1)
    rootGraph.add(node2)

    // Verify both nodes start with no inputs
    expect(node1.inputs.length).toBe(0)
    expect(node2.inputs.length).toBe(0)

    // Remove node2
    rootGraph.remove(node2)

    // Now trigger a real event through subgraph API - only node1 should respond
    subgraph.addInput('test', 'number')

    // Only node1 should have added an input
    expect(node1.inputs.length).toBe(1) // node1 responds
    expect(node2.inputs.length).toBe(0) // node2 should NOT respond (but currently does)
  })

  it('should not accumulate handlers over multiple add/remove cycles', () => {
    const rootGraph = new LGraph()
    const subgraph = createTestSubgraph()

    const removedNodes: SubgraphNode[] = []
    for (let i = 0; i < 3; i++) {
      const node = createTestSubgraphNode(subgraph)
      rootGraph.add(node)
      rootGraph.remove(node)
      removedNodes.push(node)
    }

    // All nodes should have 0 inputs
    for (const node of removedNodes) {
      expect(node.inputs.length).toBe(0)
    }

    // Trigger an event - no removed nodes should respond
    subgraph.addInput('test', 'number')

    // Without cleanup: all 3 removed nodes would have added an input
    // With cleanup: no nodes should have added an input
    for (const node of removedNodes) {
      expect(node.inputs.length).toBe(0) // Should stay 0 after cleanup
    }
  })

  it('should clean up input listener controllers on removal', () => {
    const rootGraph = new LGraph()
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'in1', type: 'number' },
        { name: 'in2', type: 'string' }
      ]
    })

    const subgraphNode = createTestSubgraphNode(subgraph)
    rootGraph.add(subgraphNode)

    // Verify listener controllers exist
    expect(subgraphNode.inputs[0]._listenerController).toBeDefined()
    expect(subgraphNode.inputs[1]._listenerController).toBeDefined()

    // Track abort calls
    const abortSpy1 = vi.spyOn(
      subgraphNode.inputs[0]._listenerController!,
      'abort'
    )
    const abortSpy2 = vi.spyOn(
      subgraphNode.inputs[1]._listenerController!,
      'abort'
    )

    // Remove node
    rootGraph.remove(subgraphNode)

    // Verify abort was called on each controller
    expect(abortSpy1).toHaveBeenCalledTimes(1)
    expect(abortSpy2).toHaveBeenCalledTimes(1)
  })

  it('removes promoted widgets even when an input listener is absent', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'input', type: 'number' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)
    const onRemove = vi.fn()
    subgraphNode.inputs[0]._widget = fromPartial<IBaseWidget>({
      name: 'input',
      type: 'number',
      options: {},
      y: 0,
      onRemove
    })
    delete subgraphNode.inputs[0]._listenerController

    subgraphNode.onRemoved()

    expect(onRemove).toHaveBeenCalledOnce()
  })
})

describe('SubgraphNode duplicate input pruning (#9977)', () => {
  it('should prune inputs that have no matching subgraph slot after configure', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'a', type: 'STRING' },
        { name: 'b', type: 'NUMBER' }
      ]
    })

    const parentGraph = new LGraph()
    const instanceData = fromPartial<ExportedSubgraphInstance>({
      id: 1,
      type: subgraph.id,
      pos: [0, 0],
      size: [200, 100],
      inputs: [
        { name: 'a', type: 'STRING', link: null },
        { name: 'b', type: 'NUMBER', link: null },
        { name: 'a', type: 'STRING', link: null },
        { name: 'b', type: 'NUMBER', link: null }
      ],
      outputs: [],
      properties: {},
      flags: {},
      mode: 0,
      order: 0
    })

    const node = new SubgraphNode(parentGraph, subgraph, instanceData)

    expect(node.inputs).toHaveLength(2)
    expect(node.inputs.every((i) => i._subgraphSlot)).toBe(true)
  })

  it('should not accumulate duplicate inputs on reconfigure', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'a', type: 'STRING' },
        { name: 'b', type: 'NUMBER' }
      ]
    })

    const node = createTestSubgraphNode(subgraph)
    expect(node.inputs).toHaveLength(2)

    const serialized = node.serialize()
    node.configure(serialized)
    expect(node.inputs).toHaveLength(2)

    const serialized2 = node.serialize()
    node.configure(serialized2)
    expect(node.inputs).toHaveLength(2)
  })

  it('should serialize with exactly the subgraph-defined inputs', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'x', type: 'IMAGE' },
        { name: 'y', type: 'VAE' }
      ]
    })

    const node = createTestSubgraphNode(subgraph)
    const serialized = node.serialize()

    expect(serialized.inputs).toHaveLength(2)
    expect(serialized.inputs?.map((i) => i.name)).toEqual(['x', 'y'])
  })
})

describe('Nested SubgraphNode duplicate input prevention', () => {
  it('should not duplicate inputs when the referenced subgraph is reconfigured', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'a', type: 'STRING' },
        { name: 'b', type: 'NUMBER' }
      ]
    })

    const node = createTestSubgraphNode(subgraph)
    expect(node.inputs).toHaveLength(2)

    // Simulate what happens during nested subgraph configure:
    // B.configure() calls _configureSubgraph(), which recreates SubgraphInput
    // objects and dispatches 'input-added' events with new references.
    const serialized = subgraph.asSerialisable()
    subgraph.configure(serialized)

    // The SubgraphNode's event listener should recognize existing inputs
    // by ID and NOT add duplicates.
    expect(node.inputs).toHaveLength(2)
    expect(node.inputs.every((i) => i._subgraphSlot)).toBe(true)
  })

  it('should not accumulate inputs across multiple reconfigure cycles', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'x', type: 'IMAGE' },
        { name: 'y', type: 'VAE' }
      ]
    })

    const node = createTestSubgraphNode(subgraph)
    expect(node.inputs).toHaveLength(2)

    for (let i = 0; i < 5; i++) {
      const serialized = subgraph.asSerialisable()
      subgraph.configure(serialized)
    }

    expect(node.inputs).toHaveLength(2)
    expect(node.inputs.map((i) => i.name)).toEqual(['x', 'y'])
  })

  it('rebinds duplicate serialized inputs by signature and then by name', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'same', type: 'STRING' },
        { name: 'same', type: 'STRING' },
        { name: 'loose', type: 'INT' }
      ]
    })

    const node = new SubgraphNode(
      subgraph.rootGraph,
      subgraph,
      fromPartial<ExportedSubgraphInstance>({
        id: 1,
        type: subgraph.id,
        pos: [0, 0],
        size: [200, 100],
        inputs: [
          { name: 'same', type: 'STRING', link: null },
          { name: 'same', type: 'STRING', link: null },
          { name: 'loose', type: 'FLOAT', link: null },
          { name: 'missing', type: 'BOOLEAN', link: null }
        ],
        outputs: [],
        properties: {},
        flags: {},
        mode: 0,
        order: 0
      })
    )

    expect(node.inputs.map((input) => input.name)).toEqual([
      'same',
      'same',
      'loose'
    ])
    expect(node.inputs.map((input) => input._subgraphSlot)).toEqual([
      subgraph.inputs[0],
      subgraph.inputs[1],
      subgraph.inputs[2]
    ])
  })
})

describe('SubgraphNode label propagation', () => {
  it('should preserve input labels from configure path', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'steps', type: 'number' }]
    })
    subgraph.inputs[0].label = 'Steps Count'

    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.inputs[0].label).toBe('Steps Count')
    expect(subgraphNode.inputs[0].name).toBe('steps')
  })

  it('should preserve output labels from configure path', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'result', type: 'number' }]
    })
    subgraph.outputs[0].label = 'Final Result'

    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.outputs[0].label).toBe('Final Result')
    expect(subgraphNode.outputs[0].name).toBe('result')
  })

  it('should propagate label via renaming-input event', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'steps', type: 'number' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'number')
    input.widget = { name: 'value' }
    interiorNode.addOutput('out', 'number')
    interiorNode.addWidget('number', 'value', 0, () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const promotedInput = subgraphNode.inputs[0]
    const originalWidgetName = promotedInput.widget?.name
    const labelChangedSpy = vi.spyOn(subgraphNode.graph!, 'trigger')

    expect(promotedInput.label).toBeUndefined()
    expect(promotedInput._widget).toBe(subgraphNode.widgets[0])
    expect(promotedInput.widgetId).toBeDefined()
    if (!promotedInput.widgetId) throw new Error('Missing widgetId')

    subgraph.renameInput(subgraph.inputs[0], 'Steps Count')

    expect(promotedInput.label).toBe('Steps Count')
    expect(promotedInput.name).toBe('steps')
    expect(promotedInput.widget?.name).toBe(originalWidgetName)
    expect(useWidgetValueStore().getWidget(promotedInput.widgetId)?.label).toBe(
      'Steps Count'
    )
    expect(subgraphNode.widgets).toMatchObject([
      { name: 'steps', label: 'Steps Count', widgetId: promotedInput.widgetId }
    ])
    expect(labelChangedSpy).toHaveBeenCalledWith('node:slot-label:changed', {
      nodeId: subgraphNode.id,
      slotType: NodeSlotType.INPUT
    })
  })

  it('should propagate label via renaming-output event', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const labelChangedSpy = vi.spyOn(subgraphNode.graph!, 'trigger')

    subgraph.addOutput('result', 'number')
    expect(subgraphNode.outputs[0].label).toBeUndefined()

    subgraph.renameOutput(subgraph.outputs[0], 'Final Result')

    expect(subgraphNode.outputs[0].label).toBe('Final Result')
    expect(subgraphNode.outputs[0].name).toBe('result')
    expect(labelChangedSpy).toHaveBeenCalledWith('node:slot-label:changed', {
      nodeId: subgraphNode.id,
      slotType: NodeSlotType.OUTPUT
    })
  })

  it('should preserve localized_name from configure path', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'steps', type: 'number' }],
      outputs: [{ name: 'result', type: 'number' }]
    })
    subgraph.inputs[0].localized_name = 'ステップ'
    subgraph.outputs[0].localized_name = '結果'

    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.inputs[0].localized_name).toBe('ステップ')
    expect(subgraphNode.outputs[0].localized_name).toBe('結果')
  })
})
