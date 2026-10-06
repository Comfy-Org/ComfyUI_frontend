import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useImageUploadWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IComboWidget } from '@/lib/litegraph/src/types/widgets'
import type { ResultItem } from '@/platform/remote/comfyui/execution/types'
import { useToast } from '@/components/ui/toast/toastStore'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import type { useNodeImageUpload } from '@/composables/node/useNodeImageUpload'

type CapturedImageUploadOptions = Parameters<typeof useNodeImageUpload>[1]

const mocks = vi.hoisted(() => ({
  capturedUploadOptions: undefined as CapturedImageUploadOptions | undefined,
  openFileSelection: vi.fn(),
  showPreview: vi.fn(),
  captureCanvasState: vi.fn()
}))

vi.mock(import('@/composables/node/useNodeImage'), () => ({
  useNodeImage: () => ({ showPreview: mocks.showPreview }),
  useNodeVideo: () => ({ showPreview: mocks.showPreview })
}))

vi.mock<unknown>(import('@/composables/node/useNodeImageUpload'), () => ({
  useNodeImageUpload: (
    _node: LGraphNode,
    options: CapturedImageUploadOptions
  ) => {
    mocks.capturedUploadOptions = options
    return { openFileSelection: mocks.openFileSelection }
  }
}))

vi.mock(import('@/i18n'))

vi.mock(import('@/utils/litegraphUtil'))

function createUploadNode(initialValue: string = 'missing.png') {
  const onWidgetChanged = vi.fn()
  const node = new LGraphNode('LoadImage', 'LoadImage')
  node.onWidgetChanged = onWidgetChanged
  const fileComboWidget = node.addWidget(
    'combo',
    'image',
    initialValue,
    () => undefined,
    { values: ['missing.png'] }
  ) as IComboWidget

  return { fileComboWidget, node, onWidgetChanged }
}

function construct(node: LGraphNode) {
  useImageUploadWidget()(
    node,
    'upload',
    [
      'IMAGEUPLOAD',
      { imageInputName: 'image', image_upload: true }
    ] as InputSpec,
    fromPartial({})
  )
}

function constructVideo(node: LGraphNode) {
  useImageUploadWidget()(
    node,
    'upload',
    [
      'IMAGEUPLOAD',
      { imageInputName: 'image', video_upload: true }
    ] as InputSpec,
    fromPartial({})
  )
}

const outputFolderCases: {
  name: string
  value: string | ResultItem
  expected: string
}[] = [
  {
    name: 'formats dropped ResultItems from their own type',
    value: {
      filename: 'generated.png',
      subfolder: 'runs',
      type: 'output'
    },
    expected: 'runs/generated.png [output]'
  },
  {
    name: 'formats string uploads from the declared image folder',
    value: 'uploaded.png',
    expected: 'uploaded.png [output]'
  }
]

beforeEach(() => {
  useWorkflowStore().activeWorkflow = fromPartial({
    changeTracker: { captureCanvasState: mocks.captureCanvasState }
  })
  vi.mocked(useNodeOutputStore().setNodeOutputs).mockImplementation(
    () => undefined
  )
})

describe('useImageUploadWidget', () => {
  beforeEach(() => {
    mocks.capturedUploadOptions = undefined
    mocks.captureCanvasState.mockClear()
    vi.stubGlobal('requestAnimationFrame', vi.fn())
  })

  it('emits onWidgetChanged after upload changes the combo widget value', () => {
    const { fileComboWidget, node, onWidgetChanged } = createUploadNode()

    construct(node)

    mocks.capturedUploadOptions?.onUploadComplete(['uploaded.png'])

    expect(fileComboWidget.value).toBe('uploaded.png')
    expect(useNodeOutputStore().setNodeOutputs).toHaveBeenCalledWith(
      node,
      'uploaded.png',
      {
        isAnimated: false
      }
    )
    expect(onWidgetChanged).toHaveBeenCalledWith(
      'image',
      'uploaded.png',
      'missing.png',
      fileComboWidget
    )
  })

  it('gives video upload widgets a filter for uploadable videos', () => {
    const { node } = createUploadNode()
    constructVideo(node)

    expect(
      mocks.capturedUploadOptions?.fileFilter?.(
        new File([], 'extensionless', { type: 'video/mp4' })
      )
    ).toBe(false)
    expect(
      mocks.capturedUploadOptions?.fileFilter?.(
        new File([], 'clip.mp4', { type: 'video/mp4' })
      )
    ).toBe(true)
  })

  it('claims and alerts only when a video lacks an extension', () => {
    const { node } = createUploadNode()
    constructVideo(node)

    expect(
      mocks.capturedUploadOptions?.onReject?.([
        new File([], 'extensionless', { type: 'video/mp4' })
      ])
    ).toBe(true)

    expect(useToast().warning).toHaveBeenCalledWith('Alert', {
      description: 'g.videoFilenameExtensionRequired'
    })

    vi.mocked(useToast().warning).mockClear()

    expect(
      mocks.capturedUploadOptions?.onReject?.([
        new File([], 'image.png', { type: 'image/png' })
      ])
    ).toBe(false)
    expect(useToast().warning).not.toHaveBeenCalled()
  })

  it('previews the combo value once the initial frame runs', () => {
    const { node } = createUploadNode('beach.jpg')
    const frame = vi.fn()
    vi.stubGlobal('requestAnimationFrame', frame)

    construct(node)
    frame.mock.calls[0][0]()

    expect(useNodeOutputStore().setNodeOutputs).toHaveBeenCalledWith(
      node,
      'beach.jpg',
      {
        isAnimated: false
      }
    )
  })

  it('loads the new preview when the file combo changes', () => {
    const { fileComboWidget, node } = createUploadNode()
    construct(node)
    fileComboWidget.value = 'beach.jpg'

    fileComboWidget.callback?.('beach.jpg')

    expect(useNodeOutputStore().setNodeOutputs).toHaveBeenCalledWith(
      node,
      'beach.jpg',
      { isAnimated: false }
    )
    expect(mocks.showPreview).toHaveBeenCalledWith({ block: false })
  })

  it('does not preview a combo whose value is still unset', () => {
    const { fileComboWidget, node } = createUploadNode()
    Object.assign(fileComboWidget, { value: undefined })
    const frame = vi.fn()
    vi.stubGlobal('requestAnimationFrame', frame)

    construct(node)
    frame.mock.calls[0][0]()

    expect(useNodeOutputStore().setNodeOutputs).not.toHaveBeenCalled()
    expect(mocks.showPreview).toHaveBeenCalled()
  })

  it.for(outputFolderCases)('$name', ({ value, expected }) => {
    const { fileComboWidget, node } = createUploadNode()
    const constructor = useImageUploadWidget()

    constructor(
      node,
      'upload',
      [
        'IMAGEUPLOAD',
        {
          imageInputName: 'image',
          image_upload: true,
          image_folder: 'output'
        }
      ] as InputSpec,
      fromPartial({})
    )

    mocks.capturedUploadOptions?.onUploadComplete([value])

    expect(fileComboWidget.value).toBe(expected)
  })

  it('captures canvas state after upload so the draft persists the new value', () => {
    const { fileComboWidget, node } = createUploadNode()
    const constructor = useImageUploadWidget()

    constructor(
      node,
      'upload',
      [
        'IMAGEUPLOAD',
        { imageInputName: 'image', image_upload: true }
      ] as InputSpec,
      fromPartial({})
    )

    mocks.capturedUploadOptions?.onUploadComplete(['uploaded.png'])

    expect(fileComboWidget.value).toBe('uploaded.png')
    expect(mocks.captureCanvasState).toHaveBeenCalled()
  })

  it('captures canvas state when the server keeps the optimistic filename', () => {
    const { fileComboWidget, node } = createUploadNode()
    const constructor = useImageUploadWidget()

    constructor(
      node,
      'upload',
      [
        'IMAGEUPLOAD',
        { imageInputName: 'image', image_upload: true }
      ] as InputSpec,
      fromPartial({})
    )

    mocks.capturedUploadOptions?.onUploadStart?.([
      new File([], 'uploaded.png', { type: 'image/png' })
    ])
    mocks.capturedUploadOptions?.onUploadComplete(['uploaded.png'])

    expect(fileComboWidget.value).toBe('uploaded.png')
    expect(mocks.captureCanvasState).toHaveBeenCalled()
  })
})
