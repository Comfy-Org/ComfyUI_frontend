import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import { useWidgetSelectActions } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectActions'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const mockCheckState = vi.hoisted(() => vi.fn())

vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const actual = await vi.importActual(
    '@/platform/workflow/management/stores/workflowStore'
  )
  return {
    ...actual,
    useWorkflowStore: () => ({
      activeWorkflow: {
        changeTracker: {
          checkState: mockCheckState
        }
      }
    })
  }
})

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    apiURL: vi.fn((url: string) => url),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

function createItems(...names: string[]): FormDropdownItem[] {
  return names.map((name, i) => ({
    id: `input-${i}`,
    name,
    label: name,
    preview_url: ''
  }))
}

describe('useWidgetSelectActions', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockCheckState.mockClear()
  })

  describe('updateSelectedItems', () => {
    it('sets modelValue to the selected item name', () => {
      const modelValue = ref<string | undefined>('img_001.png')
      const items = createItems('img_001.png', 'photo_abc.jpg')
      const { updateSelectedItems } = useWidgetSelectActions({
        modelValue,
        dropdownItems: computed(() => items),
        widget: () =>
          ({
            name: 'test',
            type: 'combo',
            value: 'img_001.png'
          }) as SimplifiedWidget<string | undefined>,
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      updateSelectedItems(new Set(['input-1']))

      expect(modelValue.value).toBe('photo_abc.jpg')
      expect(mockCheckState).toHaveBeenCalledOnce()
    })

    it('clears modelValue when empty set', () => {
      const modelValue = ref<string | undefined>('img_001.png')
      const items = createItems('img_001.png')
      const { updateSelectedItems } = useWidgetSelectActions({
        modelValue,
        dropdownItems: computed(() => items),
        widget: () =>
          ({
            name: 'test',
            type: 'combo',
            value: 'img_001.png'
          }) as SimplifiedWidget<string | undefined>,
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      updateSelectedItems(new Set())

      expect(modelValue.value).toBeUndefined()
    })
  })

  describe('handleFilesUpdate', () => {
    it('uploads file and updates modelValue', async () => {
      const { api } = await import('@/scripts/api')
      vi.mocked(api.fetchApi).mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ name: 'uploaded.png', subfolder: '' })
      } as Response)

      const modelValue = ref<string | undefined>('img_001.png')
      const items = createItems('img_001.png')
      const widgetValues = ['img_001.png']
      const { handleFilesUpdate } = useWidgetSelectActions({
        modelValue,
        dropdownItems: computed(() => items),
        widget: () =>
          ({
            name: 'test',
            type: 'combo',
            value: 'img_001.png',
            options: { values: widgetValues }
          }) as SimplifiedWidget<string | undefined>,
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      const file = new File(['test'], 'uploaded.png', {
        type: 'image/png'
      })
      await handleFilesUpdate([file])

      expect(modelValue.value).toBe('uploaded.png')
      expect(mockCheckState).toHaveBeenCalledOnce()
    })
  })
})
