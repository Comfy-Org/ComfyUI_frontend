import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useImageUploadWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IComboWidget } from '@/lib/litegraph/src/types/widgets'
import type { ResultItem, ResultItemType } from '@/schemas/apiSchema'
import type { InputSpec } from '@/schemas/nodeDefSchema'

type CapturedImageUploadOptions = {
  onUploadComplete: (paths: (string | ResultItem)[]) => void
  allow_batch?: boolean
  folder?: ResultItemType
  onUploadStart?: (files: File[]) => void
  onUploadError?: () => void
}

const mocks = vi.hoisted(() => ({
  capturedUploadOptions: undefined as CapturedImageUploadOptions | undefined,
  openFileSelection: vi.fn(),
  setNodeOutputs: vi.fn(),
  showPreview: vi.fn()
}))

vi.mock('@/composables/node/useNodeImage', () => ({
  useNodeImage: () => ({ showPreview: mocks.showPreview }),
  useNodeVideo: () => ({ showPreview: mocks.showPreview })
}))

vi.mock('@/composables/node/useNodeImageUpload', () => ({
  useNodeImageUpload: (
    _node: LGraphNode,
    options: CapturedImageUploadOptions
  ) => {
    mocks.capturedUploadOptions = options
    return { openFileSelection: mocks.openFileSelection }
  }
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({
    setNodeOutputs: mocks.setNodeOutputs
  })
}))

vi.mock('@/utils/litegraphUtil', () => ({
  addToComboValues: (widget: IComboWidget, value: string) => {
    const values = widget.options?.values
    if (Array.isArray(values) && !values.includes(value)) {
      values.push(value)
    }
  }
}))

function createUploadNode() {
  const onWidgetChanged = vi.fn()
  const node = new LGraphNode('LoadImage')
  node._state.type = 'LoadImage'
  node.onWidgetChanged = onWidgetChanged
  const fileComboWidget = node.addWidget(
    'combo',
    'image',
    'missing.png',
    () => undefined,
    { values: ['missing.png'] }
  ) as IComboWidget

  return { fileComboWidget, node, onWidgetChanged }
}

describe('useImageUploadWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.capturedUploadOptions = undefined
    vi.stubGlobal('requestAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('emits onWidgetChanged after upload changes the combo widget value', () => {
    const { fileComboWidget, node, onWidgetChanged } = createUploadNode()
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
    expect(mocks.setNodeOutputs).toHaveBeenCalledWith(node, 'uploaded.png', {
      isAnimated: false
    })
    expect(onWidgetChanged).toHaveBeenCalledWith(
      'image',
      'uploaded.png',
      'missing.png',
      fileComboWidget
    )
  })
})
