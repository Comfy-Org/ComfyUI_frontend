import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef, InputSpec } from '@/schemas/nodeDefSchema'
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

type AudioUploadWidget = (
  node: LGraphNode,
  inputName: string,
  inputData?: InputSpec
) => unknown

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

// Top-level dynamic import: a static import would be hoisted above the consts
// the vi.mock factories close over.
await import('./uploadAudio')
const registeredExtensions = mockRegisterExtension.mock.calls.map(
  ([extension]) => extension as ComfyExtension
)

function loadExtension(name: string) {
  const extension = registeredExtensions.find(
    (extension) => extension.name === name
  )
  if (!extension) throw new Error(`${name} extension was not registered`)
  return extension
}

function createAudioNode(audioInputName = 'audio') {
  const audioWidget = {
    name: audioInputName,
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
  const extension = loadExtension('Comfy.UploadAudio')
  const widgets = await extension.getCustomWidgets!(fromAny({}))
  return (widgets as Record<string, AudioUploadWidget>).AUDIOUPLOAD
}

describe('Comfy.UploadAudio AUDIOUPLOAD widget', () => {
  beforeEach(() => {
    capturedDragDrop = undefined
    capturedFileSelect = undefined
    capturedPaste = undefined
  })

  it('does not preview an empty audio option', async () => {
    const AUDIOUPLOAD = await loadAudioUploadWidget()
    const { audioWidget, node } = createAudioNode()
    audioWidget.value = 'none'
    audioWidget.options.values = ['none']

    AUDIOUPLOAD(node, 'upload')

    expect(mockApiURL).not.toHaveBeenCalled()

    audioWidget.value = ''
    audioWidget.options.values = []
    audioWidget.callback()
    expect(mockApiURL).not.toHaveBeenCalled()

    audioWidget.value = 'none'
    audioWidget.options.values = ['none', 'other.mp3']
    audioWidget.callback()
    expect(mockApiURL).toHaveBeenCalledWith(
      '/view?filename=none&subfolder=&type=input'
    )
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

  it('uploads through a custom audio input named by the node definition', async () => {
    const AUDIOUPLOAD = await loadAudioUploadWidget()
    const { audioWidget, node } = createAudioNode('reference_audio')
    AUDIOUPLOAD(node, 'upload', [
      'AUDIOUPLOAD',
      { audioInputName: 'reference_audio' }
    ])
    mockFetchApi.mockResolvedValueOnce(successResponse('uploaded.mp3'))

    await capturedFileSelect!([createFile()])

    expect(audioWidget.value).toBe('uploaded.mp3')
    expect(audioWidget.options.values).toContain('uploaded.mp3')
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
  const extension = loadExtension('Comfy.AudioWidget')
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

function createNodeDef(
  requiredInputs: Record<string, InputSpec>
): ComfyNodeDef {
  return fromAny<ComfyNodeDef, unknown>({ input: { required: requiredInputs } })
}

function createCustomAudioNodeDef(): ComfyNodeDef {
  return createNodeDef({
    reference_audio: [['clip.mp3'], { audio_upload: true }]
  })
}

describe('audio node definition setup', () => {
  it('injects audioUI for custom nodes declaring an audio_upload input', async () => {
    const extension = loadExtension('Comfy.AudioWidget')
    const nodeData = createCustomAudioNodeDef()

    await extension.beforeRegisterNodeDef!(
      fromAny({ prototype: { comfyClass: 'CustomLoadAudio' } }),
      nodeData,
      fromAny({})
    )

    expect(nodeData.input?.required?.audioUI).toEqual(['AUDIO_UI', {}])
  })

  it('passes the audio_upload input name to the AUDIOUPLOAD widget', async () => {
    const extension = loadExtension('Comfy.UploadAudio')
    const nodeData = createCustomAudioNodeDef()

    await extension.beforeRegisterNodeDef!(fromAny({}), nodeData, fromAny({}))

    expect(nodeData.input?.required?.upload).toEqual([
      'AUDIOUPLOAD',
      { audioInputName: 'reference_audio' }
    ])
  })

  it('skips nodes without an audio_upload input', async () => {
    const extension = loadExtension('Comfy.UploadAudio')
    const nodeData = createNodeDef({ audio: [['clip.mp3'], {}] })

    await extension.beforeRegisterNodeDef!(fromAny({}), nodeData, fromAny({}))

    expect(nodeData.input?.required?.upload).toBeUndefined()
  })
})
