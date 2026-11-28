import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { DraggedAssetInfo } from '@/platform/assets/integration/assetDrop'
import { MIME_ASSET_INFO } from '@/platform/assets/constants/assetDrag'
import { useImageUploadWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget'
import { api } from '@/scripts/api'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { IComboWidget } from '@comfyorg/graph-model/widgets'
import type { InputSpec } from '@comfyorg/object-info-parser'

vi.mock(import('@/composables/node/useNodeImage'), () => ({
  useNodeImage: () => ({ showPreview: vi.fn() }),
  useNodeVideo: () => ({ showPreview: vi.fn() })
}))

vi.mock(import('@/i18n'))

vi.mock(import('@/scripts/api'))

const loaderUploads = {
  'Load Image': 'image_upload',
  'Load Video': 'video_upload'
} as const

function createLoader(loader: keyof typeof loaderUploads) {
  const node = new LGraphNode(loader, loader)
  const fileCombo = node.addWidget(
    'combo',
    'file',
    'existing',
    () => undefined,
    { values: ['existing'] }
  ) as IComboWidget
  useImageUploadWidget()(
    node,
    'upload',
    [
      'IMAGEUPLOAD',
      { imageInputName: 'file', [loaderUploads[loader]]: true }
    ] as InputSpec,
    fromPartial({})
  )
  return { node, fileCombo }
}

function dropOutput(node: LGraphNode, output: DraggedAssetInfo) {
  const dataTransfer = new DataTransfer()
  dataTransfer.setData(MIME_ASSET_INFO, JSON.stringify(output))
  dataTransfer.setData('text/uri-list', 'http://localhost:3000/api/view')
  const event = new DragEvent('drop')
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  return node.onDragDrop?.(event)
}

const rejected = {
  value: 'existing',
  warnings: [['mediaAsset.unsupportedFileType']]
}

describe('dropping a finished output on a loader node', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn())
    vi.mocked(useNodeOutputStore().setNodeOutputs).mockImplementation(
      () => undefined
    )
  })

  it.for([
    {
      loader: 'Load Image',
      output: { filename: 'frame.png', media_kind: 'image' },
      value: 'frame.png [output]',
      warnings: []
    },
    {
      loader: 'Load Image',
      output: { filename: 'frame.mp4', media_kind: 'image' },
      value: 'frame.mp4 [output]',
      warnings: []
    },
    {
      loader: 'Load Image',
      output: { filename: 'scan.unknownext' },
      value: 'scan.unknownext [output]',
      warnings: []
    },
    {
      loader: 'Load Image',
      output: {
        filename: 'ComfyUI_temp_x.png',
        subfolder: 'previews',
        type: 'temp',
        media_kind: 'image'
      },
      value: 'previews/ComfyUI_temp_x.png [temp]',
      warnings: []
    },
    {
      loader: 'Load Image',
      output: { filename: 'clip.mpeg', media_kind: 'video' },
      ...rejected
    },
    {
      loader: 'Load Image',
      output: { filename: 'clip.mp4' },
      ...rejected
    },
    {
      loader: 'Load Image',
      output: { filename: 'voice.wav', media_kind: 'audio' },
      ...rejected
    },
    {
      loader: 'Load Video',
      output: { filename: 'clip.mpeg', media_kind: 'video' },
      value: 'clip.mpeg [output]',
      warnings: []
    },
    {
      loader: 'Load Video',
      output: { filename: 'frame.png', media_kind: 'image' },
      ...rejected
    }
  ] as const)(
    'leaves $loader on $value for a dropped $output.filename declared as $output.media_kind',
    async ({ loader, output, value, warnings }) => {
      const { node, fileCombo } = createLoader(loader)

      const handled = await dropOutput(node, {
        subfolder: '',
        type: 'output',
        ...output
      })

      expect(handled).toBe(true)
      expect(fileCombo.value).toBe(value)
      expect(vi.mocked(useToast().warning).mock.calls).toEqual(warnings)
      expect(api.fetchApi).not.toHaveBeenCalled()
    }
  )
})
