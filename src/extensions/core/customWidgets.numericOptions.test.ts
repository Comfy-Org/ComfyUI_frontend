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

const PRIMITIVE_INT_INPUT_SPEC: InputSpec = {
  type: 'INT',
  name: 'value',
  default: 0,
  min: -Number.MAX_SAFE_INTEGER,
  max: Number.MAX_SAFE_INTEGER
}

const FLOAT_TYPES = {
  primitive: PRIMITIVE_FLOAT_INPUT_SPEC,
  quarterStep: { ...PRIMITIVE_FLOAT_INPUT_SPEC, step: 0.25 },
  zeroStep: { ...PRIMITIVE_FLOAT_INPUT_SPEC, step: 0 },
  unrounded: { ...PRIMITIVE_FLOAT_INPUT_SPEC, round: false },
  declaredRound: { ...PRIMITIVE_FLOAT_INPUT_SPEC, round: 0.05 }
} satisfies Record<string, InputSpec>

type FloatType = keyof typeof FLOAT_TYPES

const TEST_PRIMITIVE_INT_TYPE = 'test/PrimitiveIntNumericOptions'

const floatNodeType = (name: string) => `test/${name}FloatNumericOptions`

function primitiveFloatNodeClass(spec: InputSpec) {
  return class extends LGraphNode {
    static override title = 'Float'

    constructor() {
      super('PrimitiveFloat')
      this.comfyClass = 'PrimitiveFloat'
      this.addOutput('FLOAT', 'FLOAT')
      useFloatWidget()(this, spec)
    }
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

const floatNodeClasses = Object.entries(FLOAT_TYPES).map(([name, spec]) => ({
  type: floatNodeType(name),
  nodeClass: primitiveFloatNodeClass(spec)
}))

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

const createFloatNode = (name: FloatType = 'primitive') =>
  createNode(floatNodeType(name))

describe('Primitive numeric widget options', () => {
  beforeAll(async () => {
    for (const { nodeClass } of floatNodeClasses)
      await extension.beforeRegisterNodeDef?.(
        nodeClass,
        { name: 'PrimitiveFloat' } as ComfyNodeDef,
        app
      )
    await extension.beforeRegisterNodeDef?.(
      TestPrimitiveIntNode,
      { name: 'PrimitiveInt' } as ComfyNodeDef,
      app
    )
  })

  beforeEach(() => {
    for (const { type, nodeClass } of floatNodeClasses)
      LiteGraph.registerNodeType(type, nodeClass)
    LiteGraph.registerNodeType(TEST_PRIMITIVE_INT_TYPE, TestPrimitiveIntNode)
  })

  describe('PrimitiveFloat', () => {
    it('steps by the increment declared in the node definition', () => {
      const { widget } = createFloatNode()

      expect(widget.options.step2).toBe(0.1)
      expect(getWidgetStep(widget.options)).toBe(0.1)
    })

    it('rounds to the granularity declared in the node definition', () => {
      const { widget } = createFloatNode()

      expect(widget.options.round).toBe(0.1)
      expect(widget.options.precision).toBe(1)
    })

    it('keeps the declared step when the float rounding setting adds decimal places', () => {
      stubSettings({ 'Comfy.FloatRoundingPrecision': 3 })
      const { widget } = createFloatNode()

      expect(widget.options.step2).toBe(0.1)
      expect(getWidgetStep(widget.options)).toBe(0.1)
      expect(widget.options.round).toBe(0.001)
      expect(widget.options.precision).toBe(3)
    })

    it('does not round when float rounding is disabled', () => {
      stubSettings({ 'Comfy.DisableFloatRounding': true })
      const { widget } = createFloatNode()

      expect(widget.options.round).toBeUndefined()

      onFloatValueChange.call(widget, 0.123456)
      expect(widget.value).toBe(0.123456)
    })

    it('keeps rounding off when precision is set on a node that does not round', () => {
      stubSettings({ 'Comfy.DisableFloatRounding': true })
      const { node, widget } = createFloatNode()

      node.properties.precision = 3

      expect(widget.options.round).toBeUndefined()
      expect(widget.options.step2).toBe(0.001)
    })

    it('keeps rounding off when precision is set, rounding is disabled and the definition declares round: false', () => {
      stubSettings({ 'Comfy.DisableFloatRounding': true })
      const { node, widget } = createFloatNode('unrounded')

      node.properties.precision = 3

      onFloatValueChange.call(widget, 0.123456)
      expect(widget.value).toBe(0.123456)
    })

    it('honours a round declared in the node definition, refined by node precision', () => {
      const { node, widget } = createFloatNode('declaredRound')

      expect(widget.options.round).toBe(0.05)

      node.properties.precision = 3

      expect(widget.options.round).toBe(0.001)
    })

    it.for([324, Number.POSITIVE_INFINITY, Number.NaN])(
      'keeps precision within what toFixed accepts (%s)',
      (precision) => {
        const { node, widget } = createFloatNode()

        node.properties.precision = precision

        expect(widget.options.precision).toBeGreaterThanOrEqual(0)
        expect(widget.options.precision).toBeLessThanOrEqual(100)
        expect(() => onFloatValueChange.call(widget, 0.123456)).not.toThrow()
        expect(Number.isFinite(widget.value)).toBe(true)
      }
    )

    it.for(['3', null])(
      'falls back to the declared precision for a non-numeric property (%s)',
      (precision) => {
        const { node, widget } = createFloatNode()

        node.properties.precision = precision

        expect(widget.options.precision).toBe(1)
        expect(widget.options.step2).toBe(0.1)
      }
    )

    it('normalises an out-of-range global rounding precision', () => {
      stubSettings({ 'Comfy.FloatRoundingPrecision': 101 })
      const { widget } = createFloatNode()

      expect(widget.options.precision).toBe(100)
      expect(() => onFloatValueChange.call(widget, 0.123456)).not.toThrow()
    })

    it.for([0, -1, false, '', Number.NaN])(
      'ignores an unusable round property rather than disabling rounding (%s)',
      (round) => {
        const { node, widget } = createFloatNode()

        node.properties.round = round

        expect(widget.options.round).toBe(0.1)
      }
    )

    it('keeps a declared step that is not a power of ten', () => {
      const { widget } = createFloatNode('quarterStep')

      expect(widget.options.step2).toBe(0.25)
      expect(getWidgetStep(widget.options)).toBe(0.25)
    })

    it('keeps the stepper usable when the definition declares a zero step', () => {
      const { widget } = createFloatNode('zeroStep')

      expect(widget.options.step2).toBe(0.1)
    })

    it.for([0, -1, Number.POSITIVE_INFINITY, '0.5'])(
      'ignores an unusable step property rather than adopting it (%s)',
      (step) => {
        const { node, widget } = createFloatNode()

        node.properties.step = step

        expect(widget.options.step2).toBe(0.1)
      }
    )

    it('ignores an unusable precision rather than half-applying it', () => {
      const { node, widget } = createFloatNode('quarterStep')

      node.properties.precision = Number.NaN

      expect(widget.options.step2).toBe(0.25)
    })

    it.for([
      { precision: 0, usedPrecision: 0, expected: 1 },
      { precision: 1, usedPrecision: 1, expected: 0.1 },
      { precision: 2, usedPrecision: 2, expected: 0.01 },
      { precision: 3, usedPrecision: 3, expected: 0.001 },
      { precision: 4, usedPrecision: 4, expected: 0.0001 },
      { precision: 5, usedPrecision: 5, expected: 0.00001 },
      { precision: 6, usedPrecision: 6, expected: 0.000001 },
      { precision: 1.5, usedPrecision: 1, expected: 0.1 },
      { precision: -1, usedPrecision: 0, expected: 1 },
      { precision: 101, usedPrecision: 100, expected: 1e-100 }
    ])(
      'steps and rounds by one unit of the last decimal place at precision $precision',
      ({ precision, usedPrecision, expected }) => {
        const { node, widget } = createFloatNode()

        node.properties.precision = precision

        expect(widget.options.precision).toBe(usedPrecision)
        expect(widget.options.step2).toBe(expected)
        expect(widget.options.round).toBe(expected)
      }
    )

    it('prefers an explicitly configured step over one derived from node precision', () => {
      const { node, widget } = createFloatNode()

      node.properties.step = 0.25
      node.properties.precision = 3

      expect(widget.options.step2).toBe(0.25)
      expect(getWidgetStep(widget.options)).toBe(0.25)
    })
  })

  describe('PrimitiveInt', () => {
    it('steps by 1 when the node definition declares no step', () => {
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
