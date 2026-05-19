import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import type { RenderOptions } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import type { PropType } from 'vue'
import { createI18n } from 'vue-i18n'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { NodeId as VueNodeId } from '@/renderer/core/layout/types'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { seedRequiredInputMissingNodeError } from '@/utils/__tests__/executionErrorTestUtils'
import {
  createMockNodeInputSlot,
  createMockNodeOutputSlot
} from '@/utils/__tests__/litegraphTestUtils'

import NodeSlots from './NodeSlots.vue'

const toVueNodeId = (id: string | number): VueNodeId => String(id)

const makeNodeData = (overrides: Partial<VueNodeData> = {}): VueNodeData => ({
  id: '123',
  title: 'Test Node',
  type: 'TestType',
  mode: 0,
  selected: false,
  executing: false,
  inputs: [],
  outputs: [],
  widgets: [],
  flags: { collapsed: false },
  ...overrides
})

// Explicit stubs to capture props for assertions
interface StubSlotData {
  name?: string
  type?: string
  boundingRect?: [number, number, number, number]
}

const STUB_SLOT_PROPS = {
  slotData: { type: Object as PropType<StubSlotData>, required: true },
  nodeId: { type: String, required: false, default: '' },
  hasError: { type: Boolean, required: false, default: false },
  index: { type: Number, required: true },
  readonly: { type: Boolean, required: false, default: false }
} as const

const InputSlotStub = defineComponent({
  name: 'InputSlot',
  props: STUB_SLOT_PROPS,
  template: `
    <div
      class="stub-input-slot"
      :data-index="index"
      :data-name="slotData && slotData.name ? slotData.name : ''"
      :data-type="slotData && slotData.type ? slotData.type : ''"
      :data-node-id="nodeId"
      :data-has-error="hasError ? 'true' : 'false'"
      :data-readonly="readonly ? 'true' : 'false'"
    />
  `
})

const OutputSlotStub = defineComponent({
  name: 'OutputSlot',
  props: STUB_SLOT_PROPS,
  template: `
    <div
      class="stub-output-slot"
      :data-index="index"
      :data-name="slotData && slotData.name ? slotData.name : ''"
      :data-type="slotData && slotData.type ? slotData.type : ''"
      :data-node-id="nodeId"
      :data-readonly="readonly ? 'true' : 'false'"
    />
  `
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

type SlotComponentStubs = NonNullable<
  NonNullable<RenderOptions<typeof NodeSlots>['global']>['stubs']
>

const defaultSlotStubs: SlotComponentStubs = {
  InputSlot: InputSlotStub,
  OutputSlot: OutputSlotStub
}

function createTrackingStub(
  componentName: 'InputSlot' | 'OutputSlot',
  mountCounts: Map<string, number>
) {
  const cssClass =
    componentName === 'InputSlot' ? 'stub-input-slot' : 'stub-output-slot'
  return defineComponent({
    name: componentName,
    props: STUB_SLOT_PROPS,
    setup(props) {
      const key = `${props.slotData?.name ?? ''}`
      mountCounts.set(key, (mountCounts.get(key) ?? 0) + 1)
    },
    template: `
      <div
        class="${cssClass}"
        :data-index="index"
        :data-name="slotData && slotData.name ? slotData.name : ''"
      />
    `
  })
}

function renderSlots(
  nodeData: VueNodeData,
  stubs: SlotComponentStubs = defaultSlotStubs
) {
  return render(NodeSlots, {
    global: {
      plugins: [i18n, createTestingPinia({ stubActions: false })],
      stubs
    },
    props: { nodeData }
  })
}

function renderSlotsWithTracking(
  nodeData: VueNodeData,
  mountCounts: Map<string, number>,
  trackingTarget: 'InputSlot' | 'OutputSlot'
) {
  const trackingStub = createTrackingStub(trackingTarget, mountCounts)
  const stubs =
    trackingTarget === 'InputSlot'
      ? { InputSlot: trackingStub, OutputSlot: OutputSlotStub }
      : { InputSlot: InputSlotStub, OutputSlot: trackingStub }

  return renderSlots(nodeData, stubs)
}

const INPUT_SLOT_SELECTOR = '.stub-input-slot'
const OUTPUT_SLOT_SELECTOR = '.stub-output-slot'

afterEach(() => {
  vi.restoreAllMocks()
})

function querySlotElements(
  container: Element,
  selector: string
): HTMLElement[] {
  // eslint-disable-next-line testing-library/no-node-access
  const nodes = container.querySelectorAll(selector)
  return Array.from(nodes).filter(
    (el): el is HTMLElement => el instanceof HTMLElement
  )
}

function getRenderedSlotIndex(container: Element, slotName: string) {
  return Number(getRenderedSlotElement(container, slotName).dataset.index)
}

function getRenderedSlotElement(container: Element, slotName: string) {
  // eslint-disable-next-line testing-library/no-node-access
  const el = container.querySelector(`[data-name="${slotName}"]`)
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Slot element "${slotName}" not found`)
  }
  return el
}

function expectSlotError(
  container: Element,
  slotName: string,
  hasError: boolean
) {
  expect(getRenderedSlotElement(container, slotName)).toHaveAttribute(
    'data-has-error',
    hasError ? 'true' : 'false'
  )
}

describe('NodeSlots.vue', () => {
  it('filters out inputs with widget property and maps indexes correctly', () => {
    const inputs = [
      createMockNodeInputSlot({ name: 'objNoWidget', type: 'number' }),
      createMockNodeInputSlot({
        name: 'objWithWidget',
        type: 'number',
        widget: { name: 'objWithWidget' }
      }),
      createMockNodeInputSlot({ name: 'stringInput', type: 'string' })
    ]

    const { container } = renderSlots(makeNodeData({ inputs }))

    const inputEls = querySlotElements(container, INPUT_SLOT_SELECTOR)
    expect(inputEls).toHaveLength(2)

    const info = inputEls.map((el) => ({
      index: Number(el.dataset.index),
      name: el.dataset.name ?? '',
      nodeId: el.dataset.nodeId ?? '',
      type: el.dataset.type ?? '',
      readonly: el.dataset.readonly === 'true'
    }))
    expect(info).toEqual([
      {
        index: 0,
        name: 'objNoWidget',
        nodeId: '123',
        type: 'number',
        readonly: false
      },
      {
        index: 2,
        name: 'stringInput',
        nodeId: '123',
        type: 'string',
        readonly: false
      }
    ])

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('[data-name="objWithWidget"]')).toBeNull()
  })

  it('maps outputs and passes correct indexes', () => {
    const outputs = [
      createMockNodeOutputSlot({ name: 'outA', type: 'any' }),
      createMockNodeOutputSlot({ name: 'outB', type: 'any' })
    ]

    const { container } = renderSlots(makeNodeData({ outputs }))
    const outputEls = querySlotElements(container, OUTPUT_SLOT_SELECTOR)

    expect(outputEls).toHaveLength(2)
    const outInfo = outputEls.map((el) => ({
      index: Number(el.dataset.index),
      name: el.dataset.name ?? '',
      nodeId: el.dataset.nodeId ?? '',
      type: el.dataset.type ?? '',
      readonly: el.dataset.readonly === 'true'
    }))
    expect(outInfo).toEqual([
      { index: 0, name: 'outA', nodeId: '123', type: 'any', readonly: false },
      { index: 1, name: 'outB', nodeId: '123', type: 'any', readonly: false }
    ])
  })

  it('passes validation error state to matching input slots', async () => {
    const inputs = [
      createMockNodeInputSlot({ name: 'model', type: 'MODEL' }),
      createMockNodeInputSlot({ name: 'steps', type: 'INT' })
    ]
    const nodeData = makeNodeData({ inputs })
    const { container } = renderSlots(nodeData)
    seedRequiredInputMissingNodeError(
      useExecutionErrorStore(),
      nodeData.id,
      'model'
    )
    await nextTick()

    expectSlotError(container, 'model', true)
    expectSlotError(container, 'steps', false)
  })

  it('maps one-level subgraph execution ids to input slot errors', async () => {
    const subgraph = createTestSubgraph()
    const interiorNode = new LGraphNode('InteriorNode')
    interiorNode.id = 70
    interiorNode.addInput('model', 'MODEL')
    interiorNode.addInput('steps', 'INT')
    subgraph.add(interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 65 })
    const graph = subgraphNode.rootGraph
    graph.add(subgraphNode)
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    const nodeData = makeNodeData({
      id: toVueNodeId(interiorNode.id),
      subgraphId: subgraph.id,
      inputs: interiorNode.inputs
    })
    const { container } = renderSlots(nodeData)
    seedRequiredInputMissingNodeError(
      useExecutionErrorStore(),
      '65:70',
      'model'
    )
    await nextTick()

    expectSlotError(container, 'model', true)
    expectSlotError(container, 'steps', false)
  })

  it('maps nested subgraph execution ids to input slot errors', async () => {
    const innerSubgraph = createTestSubgraph()
    const innerNode = new LGraphNode('InnerNode')
    innerNode.id = 63
    innerNode.addInput('image', 'IMAGE')
    innerNode.addInput('mask', 'MASK')
    innerSubgraph.add(innerNode)

    const outerSubgraph = createTestSubgraph()
    const innerSubgraphNode = createTestSubgraphNode(innerSubgraph, {
      id: 70,
      parentGraph: outerSubgraph
    })
    outerSubgraph.add(innerSubgraphNode)

    const outerSubgraphNode = createTestSubgraphNode(outerSubgraph, { id: 65 })
    const graph = outerSubgraphNode.rootGraph
    graph.add(outerSubgraphNode)
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    const nodeData = makeNodeData({
      id: toVueNodeId(innerNode.id),
      subgraphId: innerSubgraph.id,
      inputs: innerNode.inputs
    })
    const { container } = renderSlots(nodeData)
    seedRequiredInputMissingNodeError(
      useExecutionErrorStore(),
      '65:70:63',
      'mask'
    )
    await nextTick()

    expectSlotError(container, 'image', false)
    expectSlotError(container, 'mask', true)
  })

  it('remounts OutputSlot when index shifts due to output removal', async () => {
    const mountCounts = new Map<string, number>()
    const outputs = [
      createMockNodeOutputSlot({ name: 'outA', type: 'IMAGE' }),
      createMockNodeOutputSlot({ name: 'outB', type: 'VIDEO' }),
      createMockNodeOutputSlot({ name: 'outC', type: 'AUDIO' })
    ]

    const { container, rerender } = renderSlotsWithTracking(
      makeNodeData({ outputs }),
      mountCounts,
      'OutputSlot'
    )

    expect(mountCounts.get('outC')).toBe(1)
    expect(getRenderedSlotIndex(container, 'outC')).toBe(2)

    await rerender({
      nodeData: makeNodeData({
        outputs: [
          createMockNodeOutputSlot({ name: 'outA', type: 'IMAGE' }),
          createMockNodeOutputSlot({ name: 'outC', type: 'AUDIO' })
        ]
      })
    })

    expect(getRenderedSlotIndex(container, 'outC')).toBe(1)
    expect(mountCounts.get('outC')).toBe(2)
  })

  it('renders nothing when there are no inputs/outputs', () => {
    const { container } = renderSlots(makeNodeData({ inputs: [], outputs: [] }))
    expect(querySlotElements(container, INPUT_SLOT_SELECTOR)).toHaveLength(0)
    expect(querySlotElements(container, OUTPUT_SLOT_SELECTOR)).toHaveLength(0)
  })

  it('passes correct actual indices for multi-group input layout', () => {
    const inputs = [
      createMockNodeInputSlot({ name: 'ref_images.img0', type: 'IMAGE' }),
      createMockNodeInputSlot({ name: 'ref_images.img1', type: 'IMAGE' }),
      createMockNodeInputSlot({ name: 'ref_images.img2', type: 'IMAGE' }),
      createMockNodeInputSlot({ name: 'ref_videos.vid0', type: 'VIDEO' }),
      createMockNodeInputSlot({ name: 'ref_videos.vid1', type: 'VIDEO' })
    ]

    const { container } = renderSlots(makeNodeData({ inputs }))

    const inputEls = querySlotElements(container, INPUT_SLOT_SELECTOR)

    expect(inputEls).toHaveLength(5)

    const info = inputEls.map((el) => ({
      index: Number(el.dataset.index),
      name: el.dataset.name ?? ''
    }))
    expect(info).toEqual([
      { index: 0, name: 'ref_images.img0' },
      { index: 1, name: 'ref_images.img1' },
      { index: 2, name: 'ref_images.img2' },
      { index: 3, name: 'ref_videos.vid0' },
      { index: 4, name: 'ref_videos.vid1' }
    ])
  })

  it('remounts InputSlot when index shifts due to autogrow insertion', async () => {
    const mountCounts = new Map<string, number>()
    const initialInputs = [
      createMockNodeInputSlot({ name: 'ref_images.img0', type: 'IMAGE' }),
      createMockNodeInputSlot({ name: 'ref_videos.vid0', type: 'VIDEO' })
    ]

    const { container, rerender } = renderSlotsWithTracking(
      makeNodeData({ inputs: initialInputs }),
      mountCounts,
      'InputSlot'
    )

    expect(mountCounts.get('ref_videos.vid0')).toBe(1)
    expect(getRenderedSlotIndex(container, 'ref_videos.vid0')).toBe(1)

    await rerender({
      nodeData: makeNodeData({
        inputs: [
          createMockNodeInputSlot({ name: 'ref_images.img0', type: 'IMAGE' }),
          createMockNodeInputSlot({ name: 'ref_images.img1', type: 'IMAGE' }),
          createMockNodeInputSlot({ name: 'ref_videos.vid0', type: 'VIDEO' })
        ]
      })
    })

    expect(getRenderedSlotIndex(container, 'ref_videos.vid0')).toBe(2)
    expect(mountCounts.get('ref_videos.vid0')).toBe(2)
  })
})
