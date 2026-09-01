import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IComboWidget
} from '@/lib/litegraph/src/types/widgets'
import type { ComfyApp } from '@/scripts/app'
import type { InputSpec } from '@/schemas/nodeDefSchema'

const mockSettingGet = vi.hoisted(() => vi.fn())
const mockNextValueForLinkedTarget = vi.hoisted(() => vi.fn())
const mockIsComboWidget = vi.hoisted(() => vi.fn())
const mockTransformInputSpecV1ToV2 = vi.hoisted(() => vi.fn())

function v2WidgetConstructor(kind: string) {
  return () => (_node: LGraphNode, inputSpec: { name: string }) => ({
    name: `${kind}:${inputSpec.name}`,
    options: { minNodeSize: [20, 30] }
  })
}

vi.mock('@/i18n', () => ({
  t: (key: string) => `translated:${key}`
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockSettingGet
  })
}))

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  isComboWidget: mockIsComboWidget
}))

vi.mock('./valueControl', () => ({
  nextValueForLinkedTarget: mockNextValueForLinkedTarget
}))

vi.mock('@/schemas/nodeDef/migration', () => ({
  transformInputSpecV1ToV2: mockTransformInputSpecV1ToV2
}))

vi.mock('@/core/graph/widgets/dynamicWidgets', () => ({
  dynamicWidgets: {
    DYNAMIC: () => ({
      widget: { name: 'dynamic', options: {} },
      minWidth: 1,
      minHeight: 1
    })
  }
}))

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useBooleanWidget',
  () => ({ useBooleanWidget: v2WidgetConstructor('BOOLEAN') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useBoundingBoxWidget',
  () => ({ useBoundingBoxWidget: v2WidgetConstructor('BOUNDING_BOX') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useCurveWidget',
  () => ({ useCurveWidget: v2WidgetConstructor('CURVE') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useChartWidget',
  () => ({ useChartWidget: v2WidgetConstructor('CHART') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useColorWidget',
  () => ({ useColorWidget: v2WidgetConstructor('COLOR') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useComboWidget',
  () => ({ useComboWidget: v2WidgetConstructor('COMBO') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useFloatWidget',
  () => ({ useFloatWidget: v2WidgetConstructor('FLOAT') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useGalleriaWidget',
  () => ({ useGalleriaWidget: v2WidgetConstructor('GALLERIA') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useBoundingBoxesWidget',
  () => ({ useBoundingBoxesWidget: v2WidgetConstructor('BOUNDING_BOXES') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useColorsWidget',
  () => ({ useColorsWidget: v2WidgetConstructor('COLORS') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useImageCompareWidget',
  () => ({ useImageCompareWidget: v2WidgetConstructor('IMAGECOMPARE') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget',
  () => ({
    useImageUploadWidget: () => (_node: LGraphNode, inputName: string) => ({
      widget: { name: `IMAGEUPLOAD:${inputName}`, options: {} },
      minWidth: 5,
      minHeight: 6
    })
  })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useIntWidget',
  () => ({ useIntWidget: v2WidgetConstructor('INT') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useMarkdownWidget',
  () => ({ useMarkdownWidget: v2WidgetConstructor('MARKDOWN') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/usePainterWidget',
  () => ({ usePainterWidget: v2WidgetConstructor('PAINTER') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useRangeWidget',
  () => ({ useRangeWidget: v2WidgetConstructor('RANGE') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useStringWidget',
  () => ({ useStringWidget: v2WidgetConstructor('STRING') })
)
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useTextareaWidget',
  () => ({ useTextareaWidget: v2WidgetConstructor('TEXTAREA') })
)

vi.mock('./domWidget', () => ({}))
vi.mock('./errorNodeWidgets', () => ({}))

import {
  ComfyWidgets,
  IS_CONTROL_WIDGET,
  addValueControlWidget,
  addValueControlWidgets,
  isValidWidgetType,
  updateControlWidgetLabel
} from './widgets'

// `linkedWidgets`, `beforeQueued`, and `afterQueued` already exist on
// IBaseWidget (via the litegraph augmentation), so no extra members needed.
type MockWidget = IBaseWidget

function makeTargetWidget(overrides: Partial<MockWidget> = {}): MockWidget {
  return fromPartial<MockWidget>({
    name: 'seed',
    value: 1,
    callback: vi.fn(),
    options: {},
    linkedWidgets: [],
    computedDisabled: false,
    ...overrides
  })
}

function makeNode(inputs: LGraphNode['inputs'] = []) {
  const widgets: MockWidget[] = []
  const node = Object.assign(fromPartial<LGraphNode>({}), {
    id: 42,
    inputs,
    addWidget: vi.fn(
      (
        type: string,
        name: string,
        value: string,
        callback: () => void,
        options: Record<string, unknown>
      ) => {
        const widget: MockWidget = fromPartial<MockWidget>({
          type,
          name,
          value,
          callback,
          options,
          linkedWidgets: [],
          computedDisabled: false
        })
        widgets.push(widget)
        return widget
      }
    )
  })
  return { node, widgets }
}

describe('widgets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingGet.mockReturnValue('after')
    mockNextValueForLinkedTarget.mockReturnValue('next')
    mockIsComboWidget.mockImplementation(
      (widget: MockWidget) => widget.type === 'combo'
    )
    mockTransformInputSpecV1ToV2.mockImplementation(
      (_inputData: InputSpec, options: { name: string }) => ({
        name: options.name
      })
    )
  })

  it('updates the control widget label from the configured run mode', () => {
    const widget = makeTargetWidget()

    mockSettingGet.mockReturnValue('before')
    updateControlWidgetLabel(widget)
    expect(widget.label).toBe('translated:g.control_before_generate')

    mockSettingGet.mockReturnValue('after')
    updateControlWidgetLabel(widget)
    expect(widget.label).toBe('translated:g.control_after_generate')
  })

  it('adds control and filter widgets for combo targets', () => {
    const { node, widgets } = makeNode()
    const target = makeTargetWidget({ type: 'combo', computedDisabled: true })

    const result = addValueControlWidgets(node, target, '', undefined, [
      'COMBO',
      {
        control_prefix: 'custom'
      }
    ] as InputSpec)

    expect(result).toHaveLength(2)
    expect(widgets[0].name).toBe('custom control_after_generate')
    expect(widgets[0].value).toBe('randomize')
    expect((widgets[0] as IComboWidget).options.values).toContain(
      'increment-wrap'
    )
    expect(widgets[0][IS_CONTROL_WIDGET]).toBe(true)
    expect(widgets[0].disabled).toBe(true)
    expect(widgets[1].name).toBe('custom control_filter_list')
    expect(widgets[1].disabled).toBe(true)
  })

  it('uses explicit option names and can skip the combo filter widget', () => {
    const { node, widgets } = makeNode()
    const target = makeTargetWidget({ type: 'combo' })

    addValueControlWidgets(
      node,
      target,
      'fixed',
      {
        addFilterList: false,
        controlAfterGenerateName: 'mode'
      },
      ['COMBO', {}] as InputSpec
    )

    expect(widgets).toHaveLength(1)
    expect(widgets[0].name).toBe('mode')
  })

  it('applies linked target values after queueing in after mode', () => {
    const { node, widgets } = makeNode()
    const target = makeTargetWidget()

    addValueControlWidgets(node, target)
    widgets[0].afterQueued?.({ isPartialExecution: true })

    expect(mockNextValueForLinkedTarget).toHaveBeenCalledWith({
      target,
      linkedWidgets: target.linkedWidgets,
      nodeId: 42,
      isPartialExecution: true
    })
    expect(target.value).toBe('next')
    expect(target.callback).toHaveBeenCalledWith('next')
  })

  it('waits until the second beforeQueued call in before mode', () => {
    mockSettingGet.mockReturnValue('before')
    const { node, widgets } = makeNode()
    const target = makeTargetWidget()

    addValueControlWidgets(node, target)
    widgets[0].beforeQueued?.()
    expect(mockNextValueForLinkedTarget).not.toHaveBeenCalled()

    widgets[0].beforeQueued?.({ isPartialExecution: false })
    expect(mockNextValueForLinkedTarget).toHaveBeenCalledWith(
      expect.objectContaining({ isPartialExecution: false })
    )
  })

  it('does not change the target when the target has a linked input or no next value', () => {
    const { node, widgets } = makeNode([
      { widget: { name: 'seed' }, link: 1 }
    ] as LGraphNode['inputs'])
    const target = makeTargetWidget()

    addValueControlWidgets(node, target)
    widgets[0].afterQueued?.()
    expect(mockNextValueForLinkedTarget).not.toHaveBeenCalled()

    const unlinked = makeNode()
    mockNextValueForLinkedTarget.mockReturnValue(undefined)
    addValueControlWidgets(unlinked.node, target)
    unlinked.widgets[0].afterQueued?.()
    expect(target.callback).not.toHaveBeenCalled()
  })

  it('uses the legacy single control widget name from input data before widgetName', () => {
    const { node, widgets } = makeNode()
    const target = makeTargetWidget()

    const result = addValueControlWidget(
      node,
      target,
      'fixed',
      undefined,
      'fallback',
      [
        'INT',
        {
          control_after_generate: 'from_input_data'
        }
      ] as InputSpec
    )

    expect(result).toBe(widgets[0])
    expect(widgets[0].name).toBe('from_input_data')
  })

  it('exposes transformed widget constructors and type validation', () => {
    const { node } = makeNode()

    const intWidget = ComfyWidgets.INT(
      node,
      'value',
      ['INT', {}] as InputSpec,
      fromPartial<ComfyApp>({})
    )

    expect(intWidget.widget.name).toBe('INT:value')
    expect(intWidget.minWidth).toBe(20)
    expect(intWidget.minHeight).toBe(30)
    expect(
      ComfyWidgets.IMAGEUPLOAD(
        node,
        'image',
        ['IMAGE', {}],
        fromPartial<ComfyApp>({})
      )
    ).toMatchObject({
      widget: { name: 'IMAGEUPLOAD:image' },
      minWidth: 5,
      minHeight: 6
    })
    expect(isValidWidgetType('INT')).toBe(true)
    expect(isValidWidgetType('DYNAMIC')).toBe(true)
    expect(isValidWidgetType('missing')).toBe(false)
  })
})
