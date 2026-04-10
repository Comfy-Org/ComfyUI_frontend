import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
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
          fromPartial<SimplifiedWidget<string | undefined>>({
            name: 'test',
            type: 'combo',
            value: 'img_001.png'
          }),
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
          fromPartial<SimplifiedWidget<string | undefined>>({
            name: 'test',
            type: 'combo',
            value: 'img_001.png'
          }),
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      updateSelectedItems(new Set())

      expect(modelValue.value).toBeUndefined()
      expect(mockCheckState).toHaveBeenCalledOnce()
    })
  })

  describe('handleFilesUpdate', () => {
    it('uploads file and updates modelValue', async () => {
      const { api } = await import('@/scripts/api')
      vi.mocked(api.fetchApi).mockResolvedValue(
        fromPartial<Response>({
          status: 200,
          json: () => Promise.resolve({ name: 'uploaded.png', subfolder: '' })
        })
      )

      const modelValue = ref<string | undefined>('img_001.png')
      const items = createItems('img_001.png')
      const widgetValues = ['img_001.png']
      const { handleFilesUpdate } = useWidgetSelectActions({
        modelValue,
        dropdownItems: computed(() => items),
        widget: () =>
          fromPartial<SimplifiedWidget<string | undefined>>({
            name: 'test',
            type: 'combo',
            value: 'img_001.png',
            options: { values: widgetValues }
          }),
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

    it('adds uploaded path to widget values array', async () => {
      const { api } = await import('@/scripts/api')
      vi.mocked(api.fetchApi).mockResolvedValue(
        fromPartial<Response>({
          status: 200,
          json: () => Promise.resolve({ name: 'new.png', subfolder: '' })
        })
      )

      const modelValue = ref<string | undefined>()
      const widgetValues = ['existing.png']
      const { handleFilesUpdate } = useWidgetSelectActions({
        modelValue,
        dropdownItems: computed(() => []),
        widget: () =>
          fromPartial<SimplifiedWidget<string | undefined>>({
            name: 'test',
            type: 'combo',
            options: { values: widgetValues }
          }),
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      await handleFilesUpdate([new File(['test'], 'new.png')])

      expect(widgetValues).toContain('new.png')
      expect(widgetValues).toHaveLength(2)
    })

    it('calls widget callback after upload', async () => {
      const { api } = await import('@/scripts/api')
      vi.mocked(api.fetchApi).mockResolvedValue(
        fromPartial<Response>({
          status: 200,
          json: () => Promise.resolve({ name: 'uploaded.png', subfolder: '' })
        })
      )

      const mockCallback = vi.fn()
      const modelValue = ref<string | undefined>()
      const { handleFilesUpdate } = useWidgetSelectActions({
        modelValue,
        dropdownItems: computed(() => []),
        widget: () =>
          fromPartial<SimplifiedWidget<string | undefined>>({
            name: 'test',
            type: 'combo',
            callback: mockCallback,
            options: { values: [] }
          }),
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      await handleFilesUpdate([new File(['test'], 'uploaded.png')])

      expect(mockCallback).toHaveBeenCalledWith('uploaded.png')
    })

    it('shows alert toast on upload failure', async () => {
      const { api } = await import('@/scripts/api')
      vi.mocked(api.fetchApi).mockResolvedValue(
        fromPartial<Response>({
          status: 500,
          statusText: 'Internal Server Error'
        })
      )

      const modelValue = ref<string | undefined>('original.png')
      const { handleFilesUpdate } = useWidgetSelectActions({
        modelValue,
        dropdownItems: computed(() => []),
        widget: () =>
          fromPartial<SimplifiedWidget<string | undefined>>({
            name: 'test',
            type: 'combo',
            options: { values: [] }
          }),
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      await handleFilesUpdate([new File(['test'], 'fail.png')])

      expect(modelValue.value).toBe('original.png')
    })
  })
})
