import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useNodeMenuOptions } from '@/composables/graph/useNodeMenuOptions'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    useI18n: () => ({
      t: (key: string) => key.split('.').pop() ?? key
    })
  }
})

vi.mock('@/composables/graph/useNodeCustomization', () => ({
  useNodeCustomization: () => ({
    shapeOptions: [],
    applyShape: vi.fn(),
    applyColor: vi.fn(),
    colorOptions: [],
    isLightTheme: { value: false }
  })
}))

vi.mock('@/composables/graph/useSelectedNodeActions', () => ({
  useSelectedNodeActions: () => ({
    adjustNodeSize: vi.fn(),
    toggleNodeCollapse: vi.fn(),
    toggleNodePin: vi.fn(),
    toggleNodeBypass: vi.fn(),
    runBranch: vi.fn()
  })
}))

describe('useNodeMenuOptions', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ createSpy: vi.fn }))
  })

  describe('getNodeInfoOption', () => {
    test('builds a menu option labeled "Node Info"', () => {
      const { getNodeInfoOption } = useNodeMenuOptions()
      const option = getNodeInfoOption(vi.fn())

      expect(option.label).toBe('Node Info')
      expect(option.icon).toBe('icon-[lucide--info]')
    })

    test('invokes the supplied showNodeHelp callback when the option is activated', () => {
      const showNodeHelp = vi.fn()
      const { getNodeInfoOption } = useNodeMenuOptions()
      const option = getNodeInfoOption(showNodeHelp)

      option.action?.()

      expect(showNodeHelp).toHaveBeenCalledTimes(1)
    })
  })
})
