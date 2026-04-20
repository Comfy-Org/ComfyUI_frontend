/* eslint-disable vue/one-component-per-file */
import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import { createI18n } from 'vue-i18n'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

import NodeSlots from './NodeSlots.vue'

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

function makeInputSlot(
  name: string,
  type: string,
  extra?: Partial<INodeInputSlot>
): INodeInputSlot {
  return { name, type, boundingRect: [0, 0, 0, 0], link: null, ...extra }
}

function makeOutputSlot(
  name: string,
  type: string,
  extra?: Partial<INodeOutputSlot>
): INodeOutputSlot {
  return { name, type, boundingRect: [0, 0, 0, 0], links: [], ...extra }
}

// Explicit stubs to capture props for assertions
interface StubSlotData {
  name?: string
  type?: string
  boundingRect?: [number, number, number, number]
}

const STUB_SLOT_PROPS = {
  slotData: { type: Object as PropType<StubSlotData>, required: true },
  nodeId: { type: String, required: false, default: '' },
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

function createTrackingStub(
  componentName: 'InputSlot' | 'OutputSlot',
  mountCounts: Map<string, number>
) {
  const cssClass =
    componentName === 'InputSlot' ? 'stub-input-slot' : 'stub-output-slot'
  return defineComponent({
    name: componentName,
    props: {
      slotData: { type: Object as PropType<StubSlotData>, required: true },
      nodeId: { type: String, required: false, default: '' },
      index: { type: Number, required: true }
    },
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

const mountSlots = (nodeData: VueNodeData) => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return render(NodeSlots, {
    global: {
      plugins: [i18n, createTestingPinia({ stubActions: false })],
      stubs: {
        InputSlot: InputSlotStub,
        OutputSlot: OutputSlotStub
      }
    },
    props: { nodeData }
  })
}

function mountSlotsWithTracking(
  nodeData: VueNodeData,
  mountCounts: Map<string, number>,
  trackingTarget: 'InputSlot' | 'OutputSlot'
) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  const trackingStub = createTrackingStub(trackingTarget, mountCounts)
  const stubs =
    trackingTarget === 'InputSlot'
      ? { InputSlot: trackingStub, OutputSlot: OutputSlotStub }
      : { InputSlot: InputSlotStub, OutputSlot: trackingStub }

  return render(NodeSlots, {
    global: {
      plugins: [i18n, createTestingPinia({ stubActions: false })],
      stubs
    },
    props: { nodeData }
  })
}

function getRenderedSlotIndex(container: Element, slotName: string) {
  // eslint-disable-next-line testing-library/no-node-access
  const el = container.querySelector(`[data-name="${slotName}"]`)
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Slot element "${slotName}" not found`)
  }
  return Number(el.dataset.index)
}

describe('NodeSlots.vue', () => {
  it('filters out inputs with widget property and maps indexes correctly', () => {
    const inputs: INodeInputSlot[] = [
      makeInputSlot('objNoWidget', 'number'),
      makeInputSlot('objWithWidget', 'number', {
        widget: { name: 'objWithWidget' }
      }),
      makeInputSlot('stringInput', 'string')
    ]

    const { container } = mountSlots(makeNodeData({ inputs }))

    const inputEls = Array.from(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      container.querySelectorAll('.stub-input-slot')
    ) as HTMLElement[]
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
    const outputs: INodeOutputSlot[] = [
      makeOutputSlot('outA', 'any'),
      makeOutputSlot('outB', 'any')
    ]

    const { container } = mountSlots(makeNodeData({ outputs }))
    const outputEls = Array.from(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      container.querySelectorAll('.stub-output-slot')
    ) as HTMLElement[]

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

  it('remounts OutputSlot when index shifts due to output removal', async () => {
    const mountCounts = new Map<string, number>()
    const outputs = [
      makeOutputSlot('outA', 'IMAGE'),
      makeOutputSlot('outB', 'VIDEO'),
      makeOutputSlot('outC', 'AUDIO')
    ]

    const { container, rerender } = mountSlotsWithTracking(
      makeNodeData({ outputs }),
      mountCounts,
      'OutputSlot'
    )

    expect(mountCounts.get('outC')).toBe(1)
    expect(getRenderedSlotIndex(container, 'outC')).toBe(2)

    await rerender({
      nodeData: makeNodeData({
        outputs: [
          makeOutputSlot('outA', 'IMAGE'),
          makeOutputSlot('outC', 'AUDIO')
        ]
      })
    })

    expect(getRenderedSlotIndex(container, 'outC')).toBe(1)
    expect(mountCounts.get('outC')).toBe(2)
  })

  it('renders nothing when there are no inputs/outputs', () => {
    const { container } = mountSlots(makeNodeData({ inputs: [], outputs: [] }))
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelectorAll('.stub-input-slot')).toHaveLength(0)
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelectorAll('.stub-output-slot')).toHaveLength(0)
  })

  it('passes correct actual indices for multi-group input layout', () => {
    const inputs: INodeInputSlot[] = [
      makeInputSlot('ref_images.img0', 'IMAGE'),
      makeInputSlot('ref_images.img1', 'IMAGE'),
      makeInputSlot('ref_images.img2', 'IMAGE'),
      makeInputSlot('ref_videos.vid0', 'VIDEO'),
      makeInputSlot('ref_videos.vid1', 'VIDEO')
    ]

    const { container } = mountSlots(makeNodeData({ inputs }))

    const inputEls = Array.from(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      container.querySelectorAll('.stub-input-slot')
    ) as HTMLElement[]

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
      makeInputSlot('ref_images.img0', 'IMAGE'),
      makeInputSlot('ref_videos.vid0', 'VIDEO')
    ]

    const { container, rerender } = mountSlotsWithTracking(
      makeNodeData({ inputs: initialInputs }),
      mountCounts,
      'InputSlot'
    )

    expect(mountCounts.get('ref_videos.vid0')).toBe(1)
    expect(getRenderedSlotIndex(container, 'ref_videos.vid0')).toBe(1)

    await rerender({
      nodeData: makeNodeData({
        inputs: [
          makeInputSlot('ref_images.img0', 'IMAGE'),
          makeInputSlot('ref_images.img1', 'IMAGE'),
          makeInputSlot('ref_videos.vid0', 'VIDEO')
        ]
      })
    })

    expect(getRenderedSlotIndex(container, 'ref_videos.vid0')).toBe(2)
    expect(mountCounts.get('ref_videos.vid0')).toBe(2)
  })
})
