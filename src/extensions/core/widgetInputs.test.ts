import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { IWidgetLocator } from '@/lib/litegraph/src/interfaces'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  LGraph,
  LGraphNode,
  LLink
} from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { ComfyNodeDef, InputSpec } from '@/schemas/nodeDefSchema'
import { GET_CONFIG } from '@/services/litegraphService'

type SlotWidget = IWidgetLocator & {
  [GET_CONFIG]: () => InputSpec | undefined
}

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: { graph_mouse: [0, 0] },
    registerExtension: vi.fn()
  }
}))

import { PrimitiveNode } from './widgetInputs'

const TARGET_NODE_TYPE = 'KSampler'
const TARGET_INPUT_NAME = 'sampler_name'
const ORIGINAL_OPTIONS = ['euler', 'euler_ancestral', 'heun']
const FRESH_OPTIONS = ['euler', 'euler_ancestral', 'heun', 'lcm']

function createComboWidget(
  value: IBaseWidget['value'],
  values: (string | number)[]
): IBaseWidget {
  return fromPartial<IBaseWidget>({
    type: 'combo',
    name: 'value',
    value,
    options: { values },
    callback: vi.fn()
  })
}

function createSlotWidget(config?: InputSpec): SlotWidget | undefined {
  if (!config) return undefined
  return fromPartial<SlotWidget>({
    name: TARGET_INPUT_NAME,
    [GET_CONFIG]: () => config
  })
}

type TargetNode = Pick<LGraphNode, 'id' | 'type' | 'inputs'>

function createTargetNode(
  inputWidgetName: string | undefined = TARGET_INPUT_NAME
): TargetNode {
  return fromPartial<TargetNode>({
    id: 7,
    type: TARGET_NODE_TYPE,
    inputs: [
      fromPartial<INodeInputSlot>({
        widget: inputWidgetName ? { name: inputWidgetName } : undefined
      })
    ]
  })
}

interface PrimitiveStub {
  graph?: LGraph
  outputs: INodeOutputSlot[]
  widgets: IBaseWidget[]
}

function createPrimitiveStub(options: {
  widget: IBaseWidget
  slotWidget?: SlotWidget
  targetNode?: TargetNode | null
  hasLink?: boolean
}): PrimitiveStub {
  const { widget, slotWidget, hasLink = true } = options
  const targetNode =
    options.targetNode === undefined ? createTargetNode() : options.targetNode
  const link = hasLink
    ? fromPartial<LLink>({
        target_id: targetNode?.id ?? 7,
        target_slot: 0
      })
    : undefined

  const stub = Object.create(PrimitiveNode.prototype) as PrimitiveStub
  stub.graph = fromPartial<LGraph>({
    links: link ? { 1: link } : {},
    getNodeById: vi.fn(() => targetNode ?? null)
  })
  stub.outputs = [
    fromPartial<INodeOutputSlot>({
      links: hasLink ? [1] : [],
      widget: slotWidget
    })
  ]
  stub.widgets = [widget]
  return stub
}

function refreshOnStub(
  stub: PrimitiveStub,
  defs?: Record<string, ComfyNodeDef>
) {
  ;(stub as unknown as PrimitiveNode).refreshComboInNode(defs)
}

function defsWithCombo(
  values: (string | number)[]
): Record<string, ComfyNodeDef> {
  return {
    [TARGET_NODE_TYPE]: fromPartial<ComfyNodeDef>({
      input: { required: { [TARGET_INPUT_NAME]: [values, {}] } }
    })
  }
}

describe('PrimitiveNode.refreshComboInNode', () => {
  it('updates combo options from the freshly passed defs', () => {
    const widget = createComboWidget('euler', ORIGINAL_OPTIONS)
    const stub = createPrimitiveStub({
      widget,
      slotWidget: createSlotWidget([ORIGINAL_OPTIONS, {}])
    })

    refreshOnStub(stub, defsWithCombo(FRESH_OPTIONS))

    expect(widget.options.values).toEqual(FRESH_OPTIONS)
  })

  it('preserves existing options when defs lookup yields nothing and slot config is missing', () => {
    const widget = createComboWidget('euler', ORIGINAL_OPTIONS)
    const stub = createPrimitiveStub({ widget, slotWidget: undefined })

    refreshOnStub(stub, {})

    expect(widget.options.values).toEqual(ORIGINAL_OPTIONS)
    expect(widget.value).toBe('euler')
  })

  it('preserves existing options when slot widget GET_CONFIG returns undefined', () => {
    const widget = createComboWidget('euler', ORIGINAL_OPTIONS)
    const slotWidget = fromPartial<SlotWidget>({
      name: TARGET_INPUT_NAME,
      [GET_CONFIG]: () => undefined
    })
    const stub = createPrimitiveStub({ widget, slotWidget })

    refreshOnStub(stub)

    expect(widget.options.values).toEqual(ORIGINAL_OPTIONS)
  })

  it('falls back to slot widget config when defs do not include the target node', () => {
    const widget = createComboWidget('euler', [])
    const stub = createPrimitiveStub({
      widget,
      slotWidget: createSlotWidget([ORIGINAL_OPTIONS, {}])
    })

    refreshOnStub(stub, {})

    expect(widget.options.values).toEqual(ORIGINAL_OPTIONS)
  })

  it('resets value and fires callback when current value is no longer in the new options', () => {
    const widget = createComboWidget('removed_value', ORIGINAL_OPTIONS)
    const stub = createPrimitiveStub({
      widget,
      slotWidget: createSlotWidget([ORIGINAL_OPTIONS, {}])
    })

    refreshOnStub(stub, defsWithCombo(FRESH_OPTIONS))

    expect(widget.value).toBe('euler')
    expect(widget.callback).toHaveBeenCalledWith('euler')
  })

  it('does not change value or fire callback when current value is still valid', () => {
    const widget = createComboWidget('euler', ORIGINAL_OPTIONS)
    const stub = createPrimitiveStub({
      widget,
      slotWidget: createSlotWidget([ORIGINAL_OPTIONS, {}])
    })

    refreshOnStub(stub, defsWithCombo(FRESH_OPTIONS))

    expect(widget.value).toBe('euler')
    expect(widget.callback).not.toHaveBeenCalled()
  })

  it('skips non-combo widgets', () => {
    const widget = fromPartial<IBaseWidget>({
      type: 'string',
      name: 'value',
      value: 'hello',
      options: { values: ORIGINAL_OPTIONS },
      callback: vi.fn()
    })
    const stub = createPrimitiveStub({
      widget,
      slotWidget: createSlotWidget([FRESH_OPTIONS, {}])
    })

    refreshOnStub(stub, defsWithCombo(FRESH_OPTIONS))

    expect(widget.options.values).toEqual(ORIGINAL_OPTIONS)
  })
})
