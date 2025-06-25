import type { LGraphNode } from '@comfyorg/litegraph'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useComboWidget } from '@/composables/widgets/useComboWidget'
import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

// Mock the dropdown combo widget since COMBO now uses it
vi.mock('@/composables/widgets/useDropdownComboWidget', () => ({
  useDropdownComboWidget: vi.fn(() =>
    vi.fn().mockReturnValue({ name: 'mockWidget' })
  )
}))

// Mock the domWidget store and related dependencies
vi.mock('@/scripts/domWidget', () => ({
  ComponentWidgetImpl: vi.fn().mockImplementation((config) => ({
    name: config.name,
    value: [],
    options: config.options
  })),
  addWidget: vi.fn()
}))

const createMockNode = () => {
  return {
    widgets: [],
    graph: {
      setDirtyCanvas: vi.fn()
    },
    addWidget: vi.fn(),
    addCustomWidget: vi.fn(),
    setDirtyCanvas: vi.fn()
  } as unknown as LGraphNode
}

describe('useComboWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delegate single-selection combo to dropdown widget', () => {
    const constructor = useComboWidget()
    const mockNode = createMockNode()

    const inputSpec: ComboInputSpec = {
      type: 'COMBO',
      name: 'inputName',
      options: ['option1', 'option2']
    }

    const widget = constructor(mockNode, inputSpec)

    // Should create a widget (delegated to dropdown widget)
    expect(widget).toBeDefined()
    expect(widget.name).toBe('mockWidget')
  })

  it('should use multi-select widget for multi_select combo', () => {
    const constructor = useComboWidget()
    const mockNode = createMockNode()

    const inputSpec: ComboInputSpec = {
      type: 'COMBO',
      name: 'multiSelectInput',
      options: ['option1', 'option2'],
      multi_select: { placeholder: 'Select multiple' }
    }

    const widget = constructor(mockNode, inputSpec)

    // Should create a multi-select widget
    expect(widget).toBeDefined()
    expect(widget.name).toBe('multiSelectInput')
  })

  it('should handle invalid input spec', () => {
    const constructor = useComboWidget()
    const mockNode = createMockNode()

    const invalidSpec = {
      type: 'NOT_COMBO',
      name: 'invalidInput'
    } as any

    expect(() => constructor(mockNode, invalidSpec)).toThrow(
      'Invalid input data'
    )
  })
})
