import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useComboWidget } from '@/composables/widgets/useComboWidget'
import type { InputSpec } from '@/schemas/nodeDefSchema'

vi.mock('@/stores/widgetStore', () => ({
  useWidgetStore: () => ({
    getDefaultValue: vi.fn()
  })
}))

vi.mock('@/scripts/widgets', () => ({
  addValueControlWidgets: vi.fn()
}))

describe('useComboWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should handle undefined spec', () => {
    const constructor = useComboWidget()
    const mockNode = {
      addWidget: vi.fn().mockReturnValue({ options: {} } as any)
    }

    const inputSpec: InputSpec = ['COMBO', undefined]

    const widget = constructor(
      mockNode as any,
      'inputName',
      inputSpec,
      undefined as any
    )

    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'combo',
      'inputName',
      undefined, // default value
      expect.any(Function), // callback
      expect.objectContaining({
        values: []
      })
    )
    expect(widget).toEqual({
      widget: { options: {} }
    })
  })
})
