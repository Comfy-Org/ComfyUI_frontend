import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { fromPartial } from '@total-typescript/shoehorn'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveWidgetValueAsset } from '@/platform/assets/integration/resolveWidgetValueAsset'
import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import { useWidgetSelectActions } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectActions'
import { registerTestWidget } from '@/renderer/extensions/vueNodes/widgets/components/widgetTestUtils'
import { widgetOptions } from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { useToast } from '@/components/ui/toast/toastStore'
import enMessages from '@/locales/en/main.json'

const mockCaptureCanvasState = vi.hoisted(() => vi.fn())

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/assets/integration/resolveWidgetValueAsset'))

function comboWidget(values?: string[]) {
  return registerTestWidget({
    name: 'image',
    type: 'combo',
    value: undefined,
    options: values ? { values } : {}
  })
}

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
        widgetId: comboWidget(),
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
        widgetId: comboWidget(),
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      updateSelectedItems(new Set())

      expect(modelValue.value).toBeUndefined()
      expect(mockCaptureCanvasState).toHaveBeenCalledOnce()
    })
  })

  describe('handleFilesUpdate', () => {
    it('rejects extensionless videos before upload', async () => {
      const modelValue = ref<string | undefined>('existing.mp4')
      const { handleFilesUpdate } = useWidgetSelectActions({
        modelValue,
        dropdownItems: computed(() => []),
        widgetId: comboWidget(['existing.mp4']),
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      await handleFilesUpdate([
        new File(['video'], 'extensionless', { type: 'video/mp4' })
      ])

      expect(api.fetchApi).not.toHaveBeenCalled()
      expect(modelValue.value).toBe('existing.mp4')
      expect(useToast().warning).toHaveBeenCalledWith(
        enMessages.g.videoFilenameExtensionRequired
      )
    })

    it('rejects an untyped extensionless file on a video widget', async () => {
      const modelValue = ref<string | undefined>('existing.mp4')
      const { handleFilesUpdate } = useWidgetSelectActions({
        modelValue,
        dropdownItems: computed(() => []),
        widgetId: comboWidget(['existing.mp4']),
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined,
        videoOnly: () => true
      })

      await handleFilesUpdate([new File(['video'], 'extensionless')])

      expect(api.fetchApi).not.toHaveBeenCalled()
      expect(modelValue.value).toBe('existing.mp4')
      expect(useToast().warning).toHaveBeenCalledWith(
        enMessages.g.videoFilenameExtensionRequired
      )
    })

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
        widgetId: comboWidget(widgetValues),
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

    it('gives each concurrent upload the response timeout of the whole batch', async () => {
      vi.mocked(api.fetchApi).mockImplementation(async () =>
        Response.json({ name: 'a.png', subfolder: '' })
      )
      const { handleFilesUpdate } = useWidgetSelectActions({
        modelValue: ref<string | undefined>(),
        dropdownItems: computed(() => []),
        widgetId: comboWidget([]),
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      await handleFilesUpdate([
        new File([new Uint8Array(2_621_440)], 'a.png'),
        new File([new Uint8Array(2_621_440)], 'b.png')
      ])

      expect(
        vi.mocked(api.fetchApi).mock.calls.map(([, init]) => init?.timeoutMs)
      ).toEqual([140_000, 140_000])
    })

    it('adds uploaded path to widget values array', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(
        fromPartial<Response>({
          status: 200,
          json: () => Promise.resolve({ name: 'new.png', subfolder: '' })
        })
      )

      const modelValue = ref<string | undefined>()
      const id = comboWidget(['existing.png'])
      const { handleFilesUpdate } = useWidgetSelectActions({
        modelValue,
        dropdownItems: computed(() => []),
        widgetId: id,
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      await handleFilesUpdate([new File(['test'], 'new.png')])

      const widgetValues = widgetOptions(id).values
      expect(widgetValues).toContain('new.png')
      expect(widgetValues).toHaveLength(2)
    })

    it('tells the widget about a re-upload of the file already selected', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(
        fromPartial<Response>({
          status: 200,
          json: () => Promise.resolve({ name: 'same.png', subfolder: '' })
        })
      )
      const graph = new LGraph()
      vi.mocked(app).rootGraph = graph
      const node = new LGraphNode('Load Image')
      const received: unknown[] = []
      node.addWidget(
        'combo',
        'image',
        'same.png',
        (value) => received.push(value),
        { values: ['same.png'] }
      )
      graph.add(node)
      const modelValue = ref<string | undefined>('same.png')
      const { handleFilesUpdate } = useWidgetSelectActions({
        modelValue,
        dropdownItems: computed(() => []),
        widgetId: widgetId(graph.id, node.id, 'image'),
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      await handleFilesUpdate([new File(['edited'], 'same.png')])

      expect(received).toEqual(['same.png'])
    })

    it('writes the uploaded path to the model exactly once', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(
        fromPartial<Response>({
          status: 200,
          json: () => Promise.resolve({ name: 'uploaded.png', subfolder: '' })
        })
      )

      const writeModel = vi.fn<(value: string | undefined) => void>()
      const { handleFilesUpdate } = useWidgetSelectActions({
        modelValue: computed({ get: () => undefined, set: writeModel }),
        dropdownItems: computed(() => []),
        widgetId: comboWidget([]),
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      await handleFilesUpdate([new File(['test'], 'uploaded.png')])

      expect(writeModel).toHaveBeenCalledExactlyOnceWith('uploaded.png')
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
        widgetId: comboWidget([]),
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      await handleFilesUpdate([new File(['test'], 'fail.png')])

      expect(modelValue.value).toBe('original.png')

      expect(useToast().warning).toHaveBeenCalledWith(
        'Upload failed: Internal Server Error'
      )
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
        widgetId: comboWidget([]),
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      await handleFilesUpdate([new File(['test'], 'fail.png')])

      expect(useToast().warning).toHaveBeenCalledWith('Upload failed: HTTP 502')
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
        widgetId: comboWidget([]),
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      await handleFilesUpdate([new File(['test'], 'huge.png')])

      expect(useToast().warning).toHaveBeenCalledWith(
        'File is too large to upload.'
      )
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
        widgetId: comboWidget([]),
        uploadFolder: () => 'input',
        uploadSubfolder: () => undefined
      })

      await handleFilesUpdate([new File(['test'], 'huge.png')])

      expect(useToast().warning).toHaveBeenCalledWith(
        'File is too large to upload (limit: 100 MB).'
      )
    })
  })

  describe('HDR preview', () => {
    it.for([
      {
        value: 'scenes\\sky.exr',
        image: { filename: 'sky.exr', subfolder: 'scenes', type: 'input' }
      },
      {
        value: 'sky.exr [output]',
        image: { filename: 'sky.exr', subfolder: '', type: 'output' }
      },
      {
        value: 'renders/sky.hdr [temp]',
        image: { filename: 'sky.hdr', subfolder: 'renders', type: 'temp' }
      }
    ])(
      'previews $value from its root, subfolder and filename',
      async ({ value, image }) => {
        vi.mocked(resolveWidgetValueAsset).mockResolvedValue(
          fromPartial({ preview_id: 'preview-1' })
        )
        const locatorId = fromPartial<NodeLocatorId>('7')

        useWidgetSelectActions({
          modelValue: ref<string | undefined>(value),
          dropdownItems: computed(() => []),
          widgetId: comboWidget(),
          uploadFolder: () => 'input',
          uploadSubfolder: () => undefined,
          locatorId: () => locatorId
        })

        await vi.waitFor(() =>
          expect(useNodeOutputStore().nodeOutputs[locatorId]?.images).toEqual([
            { ...image, preview_id: 'preview-1' }
          ])
        )
      }
    )
  })
})
