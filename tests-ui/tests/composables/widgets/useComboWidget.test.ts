import { createPinia, setActivePinia } from 'pinia'

import { useComboWidget } from '@/composables/widgets/useComboWidget'
import type { InputSpec } from '@/types/apiTypes'

jest.mock('@/scripts/widgets', () => ({
  addValueControlWidgets: jest.fn()
}))

describe('useComboWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    jest.clearAllMocks() // Clear mock state between tests
  })

  it('should handle undefined spec', () => {
    const constructor = useComboWidget()
    const mockNode = {
      addWidget: jest.fn().mockReturnValue({ options: {} } as any)
    }

    const inputSpec: InputSpec = ['INT', undefined]

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
        values: 'INT'
      })
    )
    expect(widget).toEqual({
      widget: { options: {} }
    })
  })
})
