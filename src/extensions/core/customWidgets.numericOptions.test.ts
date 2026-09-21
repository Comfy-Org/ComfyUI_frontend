import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { INumericWidget } from '@/lib/litegraph/src/types/widgets'
import { getWidgetStep } from '@/lib/litegraph/src/utils/widget'
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
const { useFloatWidget } =
  await import('@/renderer/extensions/vueNodes/widgets/composables/useFloatWidget')
const { useIntWidget } =
  await import('@/renderer/extensions/vueNodes/widgets/composables/useIntWidget')

// Mirrors the backend schema in comfy_extras/nodes_primitive.py:
// io.Float.Input("value", min=-sys.maxsize, max=sys.maxsize, step=0.1)
const PRIMITIVE_FLOAT_INPUT_SPEC: InputSpec = {
  type: 'FLOAT',
  name: 'value',
  default: 0,
  min: -Number.MAX_SAFE_INTEGER,
  max: Number.MAX_SAFE_INTEGER,
  step: 0.1
}

// io.Int.Input("value", min=-sys.maxsize, max=sys.maxsize, control_after_generate=fixed)
const PRIMITIVE_INT_INPUT_SPEC: InputSpec = {
  type: 'INT',
  name: 'value',
  default: 0,
  min: -Number.MAX_SAFE_INTEGER,
  max: Number.MAX_SAFE_INTEGER
}

const TEST_PRIMITIVE_FLOAT_TYPE = 'test/PrimitiveFloatNumericOptions'
const TEST_PRIMITIVE_INT_TYPE = 'test/PrimitiveIntNumericOptions'

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
  })

  beforeEach(() => {
    LiteGraph.registerNodeType(
      TEST_PRIMITIVE_FLOAT_TYPE,
      TestPrimitiveFloatNode
    )
    LiteGraph.registerNodeType(TEST_PRIMITIVE_INT_TYPE, TestPrimitiveIntNode)
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

    it.for([
      { precision: 0, expected: 1 },
      { precision: 1, expected: 0.1 },
      { precision: 2, expected: 0.01 },
      { precision: 3, expected: 0.001 }
    ])(
      'steps and rounds by one unit of the last decimal place at precision $precision',
      ({ precision, expected }) => {
        const { node, widget } = createNode(TEST_PRIMITIVE_FLOAT_TYPE)

        node.properties.precision = precision

        expect(widget.options.precision).toBe(precision)
        expect(widget.options.step2).toBeCloseTo(expected, 10)
        expect(widget.options.round).toBeCloseTo(expected, 10)
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
