import type { LGraphNode } from '@comfyorg/litegraph'
import { describe, expect, it, vi } from 'vitest'

import { useBadgedNumberInput } from '@/composables/widgets/useBadgedNumberInput'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

// Mock dependencies
vi.mock('@/scripts/domWidget', () => ({
  ComponentWidgetImpl: vi.fn().mockImplementation((config) => ({
    ...config,
    value: config.options.getValue(),
    setValue: config.options.setValue,
    options: config.options,
    props: config.props
  })),
  addWidget: vi.fn()
}))

describe('useBadgedNumberInput', () => {
  const createMockNode = (): LGraphNode =>
    ({
      id: 1,
      title: 'Test Node',
      widgets: [],
      addWidget: vi.fn()
    }) as any

  const createInputSpec = (overrides: Partial<InputSpec> = {}): InputSpec => ({
    name: 'test_input',
    type: 'number',
    ...overrides
  })

  it('creates widget constructor with default options', () => {
    const constructor = useBadgedNumberInput()
    expect(constructor).toBeDefined()
    expect(typeof constructor).toBe('function')
  })

  it('creates widget with default options', () => {
    const constructor = useBadgedNumberInput()
    const node = createMockNode()
    const inputSpec = createInputSpec()

    const widget = constructor(node, inputSpec)

    expect(widget).toBeDefined()
    expect(widget.name).toBe(inputSpec.name)
  })

  it('creates widget with custom badge state', () => {
    const constructor = useBadgedNumberInput({ badgeState: 'random' })
    const node = createMockNode()
    const inputSpec = createInputSpec()

    const widget = constructor(node, inputSpec)

    expect(widget).toBeDefined()
    // Widget is created with the props, but accessing them requires the mock structure
    expect((widget as any).props.badgeState).toBe('random')
  })

  it('creates widget with disabled state', () => {
    const constructor = useBadgedNumberInput({ disabled: true })
    const node = createMockNode()
    const inputSpec = createInputSpec()

    const widget = constructor(node, inputSpec)

    expect(widget).toBeDefined()
    expect((widget as any).props.disabled).toBe(true)
  })
})
