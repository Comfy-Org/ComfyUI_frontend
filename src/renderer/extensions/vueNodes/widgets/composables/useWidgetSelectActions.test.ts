import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { fromPartial } from '@total-typescript/shoehorn'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import { useWidgetSelectActions } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectActions'
import { api } from '@/scripts/api'
import { useToast } from '@/components/ui/toast'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const mockCaptureCanvasState = vi.hoisted(() => vi.fn())

vi.mock(import('@/scripts/api'))

function createItems(...names: string[]): FormDropdownItem[] {
  return names.map((name, i) => ({
    id: `input-${i}`,
    name,
    label: name,
    preview_url: ''
  }))
}

beforeEach(() => {
  useWorkflowStore().activeWorkflow = fromPartial({
    changeTracker: { captureCanvasState: mockCaptureCanvasState }
  })
})

describe('useWidgetSelectActions', () => {
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
      expect(mockCaptureCanvasState).toHaveBeenCalledOnce()
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
      expect(mockCaptureCanvasState).toHaveBeenCalledOnce()
    })
  })

  describe('handleFilesUpdate', () => {
    it('uploads file and updates modelValue', async () => {
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
      expect(mockCaptureCanvasState).toHaveBeenCalledOnce()
    })

    it('adds uploaded path to widget values array', async () => {
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

      expect(useToast().warning).toHaveBeenCalledWith('Alert', {
        description: 'Upload failed: Internal Server Error'
      })
    })

    it('shows a status-derived toast without a dangling separator when statusText is empty', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(
        fromPartial<Response>({
          status: 502,
          statusText: ''
        })
      )

      const { handleFilesUpdate } = useWidgetSelectActions({
        modelValue: ref<string | undefined>(),
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

      expect(useToast().warning).toHaveBeenCalledWith('Alert', {
        description: 'Upload failed: HTTP 502'
      })
    })

    it('shows a file-too-large toast on a 413 with no known upload limit', async () => {
      vi.mocked(api.getServerFeature).mockReturnValue(undefined)
      vi.mocked(api.fetchApi).mockResolvedValue(
        fromPartial<Response>({
          status: 413,
          statusText: 'Payload Too Large'
        })
      )

      const { handleFilesUpdate } = useWidgetSelectActions({
        modelValue: ref<string | undefined>(),
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

      await handleFilesUpdate([new File(['test'], 'huge.png')])

      expect(useToast().warning).toHaveBeenCalledWith('Alert', {
        description: 'File is too large to upload.'
      })
    })

    it('shows a file-too-large toast with the limit on a 413 when the server reports one', async () => {
      vi.mocked(api.getServerFeature).mockReturnValue(104_857_600)
      vi.mocked(api.fetchApi).mockResolvedValue(
        fromPartial<Response>({
          status: 413,
          statusText: 'Payload Too Large'
        })
      )

      const { handleFilesUpdate } = useWidgetSelectActions({
        modelValue: ref<string | undefined>(),
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

      await handleFilesUpdate([new File(['test'], 'huge.png')])

      expect(useToast().warning).toHaveBeenCalledWith('Alert', {
        description: 'File is too large to upload (limit: 100 MB).'
      })
    })
  })
})
