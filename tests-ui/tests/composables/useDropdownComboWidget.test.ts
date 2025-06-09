import type { LGraphNode } from '@comfyorg/litegraph'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDropdownComboWidget } from '@/composables/widgets/useDropdownComboWidget'
import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

// Mock the domWidget store and related dependencies
vi.mock('@/scripts/domWidget', () => ({
  ComponentWidgetImpl: vi.fn().mockImplementation((config) => ({
    name: config.name,
    value: '',
    options: config.options
  })),
  addWidget: vi.fn()
}))

// Mock the scripts/widgets for control widgets
vi.mock('@/scripts/widgets', () => ({
  addValueControlWidgets: vi.fn().mockReturnValue([])
}))

// Mock the remote widget functionality
vi.mock('@/composables/widgets/useRemoteWidget', () => ({
  useRemoteWidget: vi.fn(() => ({
    addRefreshButton: vi.fn()
  }))
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

describe('useDropdownComboWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('creates widget constructor successfully', () => {
    const constructor = useDropdownComboWidget()
    expect(constructor).toBeDefined()
    expect(typeof constructor).toBe('function')
  })

  it('widget constructor handles input spec correctly', () => {
    const constructor = useDropdownComboWidget()
    const mockNode = createMockNode()

    const inputSpec: ComboInputSpec = {
      name: 'test_dropdown',
      type: 'COMBO',
      options: ['option1', 'option2', 'option3']
    }

    const widget = constructor(mockNode, inputSpec)

    expect(widget).toBeDefined()
    expect(widget.name).toBe('test_dropdown')
  })

  it('widget constructor accepts default value option', () => {
    const constructor = useDropdownComboWidget({ defaultValue: 'custom' })
    expect(constructor).toBeDefined()
    expect(typeof constructor).toBe('function')
  })

  it('handles remote widgets correctly', () => {
    const constructor = useDropdownComboWidget()
    const mockNode = createMockNode()

    const inputSpec: ComboInputSpec = {
      name: 'remote_dropdown',
      type: 'COMBO',
      options: [],
      remote: {
        route: '/api/options',
        refresh_button: true
      }
    }

    const widget = constructor(mockNode, inputSpec)

    expect(widget).toBeDefined()
    expect(widget.name).toBe('remote_dropdown')
  })

  it('handles control_after_generate widgets correctly', () => {
    const constructor = useDropdownComboWidget()
    const mockNode = createMockNode()

    const inputSpec: ComboInputSpec = {
      name: 'control_dropdown',
      type: 'COMBO',
      options: ['option1', 'option2'],
      control_after_generate: true
    }

    const widget = constructor(mockNode, inputSpec)

    expect(widget).toBeDefined()
    expect(widget.name).toBe('control_dropdown')
  })
})
