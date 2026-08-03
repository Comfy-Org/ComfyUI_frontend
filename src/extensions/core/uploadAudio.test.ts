import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyExtension } from '@/types/comfy'

const { mockAddAlert, mockApiURL, mockFetchApi, mockRegisterExtension } =
  vi.hoisted(() => ({
    mockAddAlert: vi.fn(),
    mockApiURL: vi.fn((url: string) => `api:${url}`),
    mockFetchApi: vi.fn(),
    mockRegisterExtension: vi.fn()
  }))

let capturedDragDrop: ((files: File[]) => Promise<File[] | never[]>) | undefined
let capturedFileSelect:
  | ((files: File[]) => Promise<File[] | never[]>)
  | undefined
let capturedPaste: ((files: File[]) => Promise<File[] | never[]>) | undefined

type AudioUploadWidget = (node: LGraphNode, inputName: string) => unknown

vi.mock('extendable-media-recorder', () => ({
  MediaRecorder: class MockMediaRecorder {}
}))

vi.mock('@/composables/node/useNodeDragAndDrop', () => ({
  useNodeDragAndDrop: (
    _node: LGraphNode,
    options: { onDrop: typeof capturedDragDrop }
  ) => {
    capturedDragDrop = options.onDrop
  }
}))

vi.mock('@/composables/node/useNodeFileInput', () => ({
  useNodeFileInput: (
    _node: LGraphNode,
    options: { onSelect: typeof capturedFileSelect }
  ) => {
    capturedFileSelect = options.onSelect
    return { openFileSelection: vi.fn() }
  }
}))

vi.mock('@/composables/node/useNodePaste', () => ({
  useNodePaste: (
    _node: LGraphNode,
    options: { onPaste: typeof capturedPaste }
  ) => {
    capturedPaste = options.onPaste
  }
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert: mockAddAlert })
}))

vi.mock('@/renderer/extensions/vueNodes/widgets/utils/audioUtils', () => ({
  getResourceURL: (subfolder = '', filename = '', type = 'input') =>
    `/view?filename=${filename}&subfolder=${subfolder}&type=${type}`,
  splitFilePath: (path: string) => ['', path, 'input']
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: mockApiURL,
    fetchApi: mockFetchApi
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    registerExtension: mockRegisterExtension,
    rootGraph: { id: 'root' }
  }
}))

vi.mock('@/stores/widgetValueStore', () => ({
  useWidgetValueStore: () => ({
    getWidget: vi.fn()
  })
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByLocatorId: vi.fn()
}))

vi.mock('@/services/audioService', () => ({
  useAudioService: () => ({})
}))

function createFile(name = 'clip.mp3'): File {
  return new File(['audio'], name, { type: 'audio/mpeg' })
}

function successResponse(name: string, subfolder?: string) {
  return {
    status: 200,
    json: () => Promise.resolve({ name, subfolder })
  }
}

function failResponse(status = 500) {
  return {
    status,
    statusText: 'Server Error'
  }
}

function createAudioNode() {
  const audioWidget = {
    name: 'audio',
    value: 'previous.mp3',
    options: { values: ['previous.mp3'] },
    callback: vi.fn()
  }
  const audioUIWidget = {
    name: 'audioUI',
    element: document.createElement('audio'),
    value: '',
    callback: vi.fn()
  }
  const uploadWidget = { label: '', serialize: true, canvasOnly: false }
  const node = fromAny<LGraphNode, unknown>({
    widgets: [audioWidget, audioUIWidget],
    isUploading: false,
    graph: { setDirtyCanvas: vi.fn() },
    addWidget: vi.fn(() => uploadWidget),
    onWidgetChanged: vi.fn()
  })

  return { audioUIWidget, audioWidget, node, uploadWidget }
}

async function loadAudioUploadWidget() {
  vi.resetModules()
  mockRegisterExtension.mockClear()
  await import('./uploadAudio')
  const extension = mockRegisterExtension.mock.calls
    .map(([extension]) => extension as ComfyExtension)
    .find((extension) => extension.name === 'Comfy.UploadAudio')
  if (!extension)
    throw new Error('Comfy.UploadAudio extension was not registered')
  const widgets = await extension.getCustomWidgets!(fromAny({}))
  return (widgets as Record<string, AudioUploadWidget>).AUDIOUPLOAD
}

describe('Comfy.UploadAudio AUDIOUPLOAD widget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedDragDrop = undefined
    capturedFileSelect = undefined
    capturedPaste = undefined
  })

  it('sets isUploading while upload is in progress and clears it after success', async () => {
    const AUDIOUPLOAD = await loadAudioUploadWidget()
    const { audioWidget, node } = createAudioNode()
    AUDIOUPLOAD(node, 'upload')

    let resolveUpload: (response: ReturnType<typeof successResponse>) => void
    mockFetchApi.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpload = resolve
      })
    )

    const upload = capturedDragDrop!([createFile()])

    expect(node.isUploading).toBe(true)
    expect(audioWidget.value).toBe('clip.mp3')

    resolveUpload!(successResponse('uploaded.mp3', 'pasted'))
    await upload

    expect(node.isUploading).toBe(false)
    expect(audioWidget.value).toBe('pasted/uploaded.mp3')
    expect(audioWidget.options.values).toContain('pasted/uploaded.mp3')
    expect(node.onWidgetChanged).toHaveBeenCalledWith(
      'audio',
      'pasted/uploaded.mp3',
      'clip.mp3',
      audioWidget
    )
    expect(node.graph?.setDirtyCanvas).toHaveBeenCalledWith(true)
  })

  it('rejects concurrent audio uploads without starting another request', async () => {
    const AUDIOUPLOAD = await loadAudioUploadWidget()
    const { node } = createAudioNode()
    AUDIOUPLOAD(node, 'upload')
    node.isUploading = true

    const result = await capturedDragDrop!([createFile()])

    expect(result).toEqual([])
    expect(mockAddAlert).toHaveBeenCalledWith('g.uploadAlreadyInProgress')
    expect(mockFetchApi).not.toHaveBeenCalled()
  })

  it('rolls back the widget value and clears isUploading when upload fails', async () => {
    const AUDIOUPLOAD = await loadAudioUploadWidget()
    const { audioWidget, node } = createAudioNode()
    AUDIOUPLOAD(node, 'upload')
    mockFetchApi.mockResolvedValueOnce(failResponse())

    await capturedPaste!([createFile()])

    expect(node.isUploading).toBe(false)
    expect(audioWidget.value).toBe('previous.mp3')
    expect(mockAddAlert).toHaveBeenCalledWith('500 - Server Error')
    expect(node.graph?.setDirtyCanvas).toHaveBeenCalledWith(true)
  })

  it('rolls back the widget value and clears isUploading when upload throws synchronously', async () => {
    const AUDIOUPLOAD = await loadAudioUploadWidget()
    const { audioWidget, node } = createAudioNode()
    AUDIOUPLOAD(node, 'upload')
    const error = new Error('Upload failed before request promise')
    mockFetchApi.mockImplementationOnce(() => {
      throw error
    })

    await capturedDragDrop!([createFile()])

    expect(node.isUploading).toBe(false)
    expect(audioWidget.value).toBe('previous.mp3')
    expect(mockAddAlert).toHaveBeenCalledWith(error)
    expect(node.graph?.setDirtyCanvas).toHaveBeenCalledWith(true)
  })

  it('returns early when no files are provided', async () => {
    const AUDIOUPLOAD = await loadAudioUploadWidget()
    const { node } = createAudioNode()
    AUDIOUPLOAD(node, 'upload')

    const result = await capturedFileSelect!([])

    expect(result).toEqual([])
    expect(node.isUploading).toBe(false)
    expect(mockFetchApi).not.toHaveBeenCalled()
  })
})

type AudioUIWidget = (node: LGraphNode, inputName: string) => unknown

async function loadAudioUIWidget() {
  vi.resetModules()
  mockRegisterExtension.mockClear()
  await import('./uploadAudio')
  const extension = mockRegisterExtension.mock.calls
    .map(([extension]) => extension as ComfyExtension)
    .find((extension) => extension.name === 'Comfy.AudioWidget')
  if (!extension)
    throw new Error('Comfy.AudioWidget extension was not registered')
  const widgets = await extension.getCustomWidgets!(fromAny({}))
  return (widgets as Record<string, AudioUIWidget>).AUDIO_UI
}

describe('Comfy.AudioWidget AUDIO_UI widget', () => {
  it('excludes the audio player from workflow and prompt serialization', async () => {
    const AUDIO_UI = await loadAudioUIWidget()
    const domWidget = {
      serialize: true,
      options: {} as Record<string, unknown>
    }
    const node = fromAny<LGraphNode, unknown>({
      addDOMWidget: vi.fn(() => domWidget),
      constructor: { nodeData: { output_node: false } }
    })

    AUDIO_UI(node, 'audioUI')

    expect(domWidget.serialize).toBe(false)
    expect(domWidget.options.serialize).toBe(false)
  })
})
