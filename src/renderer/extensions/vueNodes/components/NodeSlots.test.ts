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

// Explicit stubs to capture props for assertions
interface StubSlotData {
  name?: string
  type?: string
  boundingRect?: [number, number, number, number]
}

const InputSlotStub = defineComponent({
  name: 'InputSlot',
  props: {
    slotData: { type: Object as PropType<StubSlotData>, required: true },
    nodeId: { type: String, required: false, default: '' },
    index: { type: Number, required: true },
    readonly: { type: Boolean, required: false, default: false }
  },
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
  props: {
    slotData: { type: Object as PropType<StubSlotData>, required: true },
    nodeId: { type: String, required: false, default: '' },
    index: { type: Number, required: true },
    readonly: { type: Boolean, required: false, default: false }
  },
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

describe('NodeSlots.vue', () => {
  it('filters out inputs with widget property and maps indexes correctly', () => {
    // Two inputs without widgets and one with widget (filtered out)
    const inputObjNoWidget: INodeInputSlot = {
      name: 'objNoWidget',
      type: 'number',
      boundingRect: [0, 0, 0, 0],
      link: null
    }
    const inputObjWithWidget: INodeInputSlot = {
      name: 'objWithWidget',
      type: 'number',
      boundingRect: [0, 0, 0, 0],
      widget: { name: 'objWithWidget' },
      link: null
    }
    const inputStringNoWidget: INodeInputSlot = {
      name: 'stringInput',
      type: 'string',
      boundingRect: [0, 0, 0, 0],
      link: null
    }
    const inputs: INodeInputSlot[] = [
      inputObjNoWidget,
      inputObjWithWidget,
      inputStringNoWidget
    ]

    const { container } = mountSlots(makeNodeData({ inputs }))

    const inputEls = Array.from(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      container.querySelectorAll('.stub-input-slot')
    ) as HTMLElement[]
    // Should filter out the widget-backed input; expect 2 inputs rendered
    expect(inputEls).toHaveLength(2)

    // Verify expected tuple of {index, name, nodeId}
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

    // Ensure widget-backed input was indeed filtered out
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('[data-name="objWithWidget"]')).toBeNull()
  })

  it('maps outputs and passes correct indexes', () => {
    const outputObj: INodeOutputSlot = {
      name: 'outA',
      type: 'any',
      boundingRect: [0, 0, 0, 0],
      links: []
    }
    const outputObjB: INodeOutputSlot = {
      name: 'outB',
      type: 'any',
      boundingRect: [0, 0, 0, 0],
      links: []
    }
    const outputs: INodeOutputSlot[] = [outputObj, outputObjB]

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
      // string output mapped to object with type 'any'
      { index: 1, name: 'outB', nodeId: '123', type: 'any', readonly: false }
    ])
  })

  it('renders nothing when there are no inputs/outputs', () => {
    const { container } = mountSlots(makeNodeData({ inputs: [], outputs: [] }))
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelectorAll('.stub-input-slot')).toHaveLength(0)
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelectorAll('.stub-output-slot')).toHaveLength(0)
  })
})
