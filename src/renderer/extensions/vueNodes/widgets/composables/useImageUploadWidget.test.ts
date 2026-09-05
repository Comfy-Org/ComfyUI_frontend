import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useImageUploadWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
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
  showPreview: vi.fn(),
  captureCanvasState: vi.fn()
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: {
      changeTracker: { captureCanvasState: mocks.captureCanvasState }
    }
  })
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
    const values = widget.options.values
    if (Array.isArray(values) && !values.includes(value)) {
      values.push(value)
    }
  }
}))

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

  it('dirties the subgraph and root canvas after an upload', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    const { node } = createUploadNode()
    subgraph.add(node)
    construct(node)
    const subgraphDirtySpy = vi.spyOn(subgraph, 'setDirtyCanvas')
    const rootGraphDirtySpy = vi.spyOn(rootGraph, 'setDirtyCanvas')

    mocks.capturedUploadOptions?.onUploadComplete(['uploaded.png'])

    expect(subgraphDirtySpy).toHaveBeenCalledWith(true)
    expect(rootGraphDirtySpy).toHaveBeenCalledWith(true)
  })

  it('previews the combo value once the initial frame runs', () => {
    const { node } = createUploadNode('beach.jpg')
    const frame = vi.fn()
    vi.stubGlobal('requestAnimationFrame', frame)

    construct(node)
    frame.mock.calls[0][0]()

    expect(mocks.setNodeOutputs).toHaveBeenCalledWith(node, 'beach.jpg', {
      isAnimated: false
    })
  })

  it('does not preview a combo whose value is still unset', () => {
    const { fileComboWidget, node } = createUploadNode()
    Object.assign(fileComboWidget, { value: undefined })
    const frame = vi.fn()
    vi.stubGlobal('requestAnimationFrame', frame)

    construct(node)
    frame.mock.calls[0][0]()

    expect(mocks.setNodeOutputs).not.toHaveBeenCalled()
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
