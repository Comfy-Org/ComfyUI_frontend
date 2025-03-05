import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useComboWidget } from '@/composables/widgets/useComboWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

vi.mock('@/scripts/widgets', () => ({
  addValueControlWidgets: vi.fn()
}))

describe('useComboWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle undefined spec', () => {
    const constructor = useComboWidget()
    const mockNode = {
      addWidget: vi.fn().mockReturnValue({ options: {} } as any)
    }

    const inputSpec: InputSpec = {
      type: 'COMBO',
      name: 'inputName'
    }

    const widget = constructor(mockNode as any, inputSpec)

    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'combo',
      'inputName',
      undefined, // default value
      expect.any(Function), // callback
      expect.objectContaining({
        values: []
      })
    )
    expect(widget).toEqual({ options: {} })
  })
})
