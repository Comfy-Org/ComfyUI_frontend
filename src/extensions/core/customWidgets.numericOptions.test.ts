import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { getActivePinia } from 'pinia'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { INumericWidget } from '@/lib/litegraph/src/types/widgets'
import { getWidgetStep } from '@/lib/litegraph/src/utils/widget'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/platform/settings/types'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'

const extensions = await vi.hoisted(async () => {
  const { createExtensionCapture } =
    await import('@/utils/__tests__/extensionTestUtils')
  return createExtensionCapture()
})
app.registerExtension = extensions.registerExtension
await import('./customWidgets')
const extension = extensions.getExtension('Comfy.CustomWidgets')

// Imported after `app` to break the `app` -> `scripts/widgets` -> composable
// cycle; a static import here yields an uninitialised binding.
const { useFloatWidget, _for_testing: floatWidgetInternals } =
  await import('@/renderer/extensions/vueNodes/widgets/composables/useFloatWidget')
const { onFloatValueChange } = floatWidgetInternals
const { useIntWidget } =
  await import('@/renderer/extensions/vueNodes/widgets/composables/useIntWidget')

// `step` is the increment PrimitiveFloat declares in
// comfy_extras/nodes_primitive.py; min/max stand in for its sys.maxsize
// bounds, which exceed what a JS number represents exactly.
const PRIMITIVE_FLOAT_INPUT_SPEC: InputSpec = {
  type: 'FLOAT',
  name: 'value',
  default: 0,
  min: -Number.MAX_SAFE_INTEGER,
  max: Number.MAX_SAFE_INTEGER,
  step: 0.1
}

// PrimitiveInt declares no step, so the widget falls back to 1.
const PRIMITIVE_INT_INPUT_SPEC: InputSpec = {
  type: 'INT',
  name: 'value',
  default: 0,
  min: -Number.MAX_SAFE_INTEGER,
  max: Number.MAX_SAFE_INTEGER
}

// A step that is not a power of ten cannot be recovered from the decimal
// places it implies, so it detects a step derived from precision.
const QUARTER_STEP_INPUT_SPEC: InputSpec = {
  ...PRIMITIVE_FLOAT_INPUT_SPEC,
  step: 0.25
}

const TEST_PRIMITIVE_FLOAT_TYPE = 'test/PrimitiveFloatNumericOptions'
const TEST_PRIMITIVE_INT_TYPE = 'test/PrimitiveIntNumericOptions'
const TEST_QUARTER_STEP_FLOAT_TYPE = 'test/QuarterStepFloatNumericOptions'

class TestPrimitiveFloatNode extends LGraphNode {
  static override title = 'Float'

  constructor() {
    super('PrimitiveFloat')
    this.comfyClass = 'PrimitiveFloat'
    this.addOutput('FLOAT', 'FLOAT')
    useFloatWidget()(this, PRIMITIVE_FLOAT_INPUT_SPEC)
  }
}

class TestPrimitiveIntNode extends LGraphNode {
  static override title = 'Int'

  constructor() {
    super('PrimitiveInt')
    this.comfyClass = 'PrimitiveInt'
    this.addOutput('INT', 'INT')
    useIntWidget()(this, PRIMITIVE_INT_INPUT_SPEC)
  }
}

class TestQuarterStepFloatNode extends LGraphNode {
  static override title = 'Float'

  constructor() {
    super('PrimitiveFloat')
    this.comfyClass = 'PrimitiveFloat'
    this.addOutput('FLOAT', 'FLOAT')
    useFloatWidget()(this, QUARTER_STEP_INPUT_SPEC)
  }
}

function stubSettings(overrides: Partial<Settings>) {
  const settingStore = useSettingStore(getActivePinia())
  vi.spyOn(settingStore, 'get').mockImplementation(
    <K extends keyof Settings>(key: K): Settings[K] =>
      (Object.hasOwn(overrides, key)
        ? overrides[key]
        : undefined) as Settings[K]
  )
}

function createNode(type: string) {
  const graph = new LGraph()
  const node = LiteGraph.createNode(type)!
  graph.add(node)
  return { node, widget: node.widgets![0] as INumericWidget }
}

describe('Primitive numeric widget options', () => {
  beforeAll(async () => {
    await extension.beforeRegisterNodeDef?.(
      TestPrimitiveFloatNode,
      { name: 'PrimitiveFloat' } as ComfyNodeDef,
      app
    )
    await extension.beforeRegisterNodeDef?.(
      TestPrimitiveIntNode,
      { name: 'PrimitiveInt' } as ComfyNodeDef,
      app
    )
    await extension.beforeRegisterNodeDef?.(
      TestQuarterStepFloatNode,
      { name: 'PrimitiveFloat' } as ComfyNodeDef,
      app
    )
  })

  beforeEach(() => {
    LiteGraph.registerNodeType(
      TEST_PRIMITIVE_FLOAT_TYPE,
      TestPrimitiveFloatNode
    )
    LiteGraph.registerNodeType(TEST_PRIMITIVE_INT_TYPE, TestPrimitiveIntNode)
    LiteGraph.registerNodeType(
      TEST_QUARTER_STEP_FLOAT_TYPE,
      TestQuarterStepFloatNode
    )
  })

  describe('PrimitiveFloat', () => {
    it('steps by the increment declared in the node definition', () => {
      const { widget } = createNode(TEST_PRIMITIVE_FLOAT_TYPE)

      expect(widget.options.step2).toBe(0.1)
      expect(getWidgetStep(widget.options)).toBe(0.1)
    })

    it('rounds to the granularity declared in the node definition', () => {
      const { widget } = createNode(TEST_PRIMITIVE_FLOAT_TYPE)

      expect(widget.options.round).toBe(0.1)
      expect(widget.options.precision).toBe(1)
    })

    it('keeps the declared step when the float rounding setting adds decimal places', () => {
      stubSettings({ 'Comfy.FloatRoundingPrecision': 3 })
      const { widget } = createNode(TEST_PRIMITIVE_FLOAT_TYPE)

      expect(widget.options.step2).toBe(0.1)
      expect(getWidgetStep(widget.options)).toBe(0.1)
      expect(widget.options.round).toBe(0.001)
      expect(widget.options.precision).toBe(3)
    })

    it('does not round when float rounding is disabled', () => {
      stubSettings({ 'Comfy.DisableFloatRounding': true })
      const { widget } = createNode(TEST_PRIMITIVE_FLOAT_TYPE)

      expect(widget.options.round).toBeUndefined()

      onFloatValueChange.call(widget, 0.123456)
      expect(widget.value).toBe(0.123456)
    })

    it('keeps rounding off when precision is set on a node that does not round', () => {
      stubSettings({ 'Comfy.DisableFloatRounding': true })
      const { node, widget } = createNode(TEST_PRIMITIVE_FLOAT_TYPE)

      node.properties.precision = 3

      expect(widget.options.round).toBeUndefined()
      expect(widget.options.step2).toBe(0.001)
    })

    it('preserves a round of zero configured on the node', () => {
      const { node, widget } = createNode(TEST_PRIMITIVE_FLOAT_TYPE)

      node.properties.round = 0

      expect(widget.options.round).toBe(0)

      onFloatValueChange.call(widget, 0.123456)
      expect(widget.value).toBe(0.123456)
    })

    it('keeps a declared step that is not a power of ten', () => {
      const { widget } = createNode(TEST_QUARTER_STEP_FLOAT_TYPE)

      expect(widget.options.step2).toBe(0.25)
      expect(getWidgetStep(widget.options)).toBe(0.25)
    })

    it.for([
      { precision: 0, expected: 1 },
      { precision: 1, expected: 0.1 },
      { precision: 2, expected: 0.01 },
      { precision: 3, expected: 0.001 },
      { precision: 4, expected: 0.0001 },
      { precision: 5, expected: 0.00001 },
      { precision: 6, expected: 0.000001 }
    ])(
      'steps and rounds by one unit of the last decimal place at precision $precision',
      ({ precision, expected }) => {
        const { node, widget } = createNode(TEST_PRIMITIVE_FLOAT_TYPE)

        node.properties.precision = precision

        expect(widget.options.precision).toBe(precision)
        expect(widget.options.step2).toBe(expected)
        expect(widget.options.round).toBe(expected)
      }
    )

    it('prefers an explicitly configured step over the derived one', () => {
      const { node, widget } = createNode(TEST_PRIMITIVE_FLOAT_TYPE)

      node.properties.step = 0.25

      expect(widget.options.step2).toBe(0.25)
      expect(getWidgetStep(widget.options)).toBe(0.25)
    })

    it('writes a step assigned through widget options back to the node property', () => {
      const { node, widget } = createNode(TEST_PRIMITIVE_FLOAT_TYPE)

      widget.options.step2 = 0.05

      expect(node.properties.step).toBe(0.05)
      expect(widget.options.step2).toBe(0.05)
    })

    it('treats min and max as unbounded until configured', () => {
      const { node, widget } = createNode(TEST_PRIMITIVE_FLOAT_TYPE)

      expect(widget.options.min).toBe(-Infinity)
      expect(widget.options.max).toBe(Infinity)

      node.properties.min = -5
      node.properties.max = 5

      expect(widget.options.min).toBe(-5)
      expect(widget.options.max).toBe(5)
    })
  })

  describe('PrimitiveInt', () => {
    it('steps by the increment declared in the node definition', () => {
      const { widget } = createNode(TEST_PRIMITIVE_INT_TYPE)

      expect(widget.options.step2).toBe(1)
      expect(getWidgetStep(widget.options)).toBe(1)
    })

    it('prefers an explicitly configured step over the derived one', () => {
      const { node, widget } = createNode(TEST_PRIMITIVE_INT_TYPE)

      node.properties.step = 8

      expect(widget.options.step2).toBe(8)
      expect(getWidgetStep(widget.options)).toBe(8)
    })
  })
})
