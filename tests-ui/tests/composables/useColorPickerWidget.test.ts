import type { LGraphNode } from '@comfyorg/litegraph'
import { describe, expect, it, vi } from 'vitest'

import { useColorPickerWidget } from '@/composables/widgets/useColorPickerWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

// Mock dependencies
vi.mock('@/scripts/domWidget', () => ({
  ComponentWidgetImpl: vi.fn().mockImplementation((config) => ({
    ...config,
    name: config.name,
    options: {
      ...config.options,
      getValue: config.options.getValue,
      setValue: config.options.setValue,
      getMinHeight: config.options.getMinHeight
    }
  })),
  addWidget: vi.fn()
}))

describe('useColorPickerWidget', () => {
  const createMockNode = (): LGraphNode =>
    ({
      id: 1,
      title: 'Test Node',
      widgets: [],
      addWidget: vi.fn()
    }) as any

  const createInputSpec = (overrides: Partial<InputSpec> = {}): InputSpec => ({
    name: 'color',
    type: 'COLOR',
    ...overrides
  })

  it('creates widget constructor with default options', () => {
    const constructor = useColorPickerWidget()
    expect(constructor).toBeDefined()
    expect(typeof constructor).toBe('function')
  })

  it('creates widget with default options', () => {
    const constructor = useColorPickerWidget()
    const node = createMockNode()
    const inputSpec = createInputSpec()

    const widget = constructor(node, inputSpec)

    expect(widget).toBeDefined()
    expect(widget.name).toBe(inputSpec.name)
  })

  it('creates widget with custom default value', () => {
    const constructor = useColorPickerWidget({
      defaultValue: '#00ff00'
    })
    const node = createMockNode()
    const inputSpec = createInputSpec()

    const widget = constructor(node, inputSpec)

    expect(widget).toBeDefined()
    expect(widget.name).toBe(inputSpec.name)
  })

  it('creates widget with custom options', () => {
    const constructor = useColorPickerWidget({
      minHeight: 60,
      serialize: false
    })
    const node = createMockNode()
    const inputSpec = createInputSpec()

    const widget = constructor(node, inputSpec)

    expect(widget).toBeDefined()
    expect(widget.name).toBe(inputSpec.name)
  })
})
