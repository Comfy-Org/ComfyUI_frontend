import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useToastStore } from '@/platform/updates/common/toastStore'

const {
  extensions,
  mockApiURL,
  mockFetchApi,
  mockMediaRecorderConstruct,
  mockMediaRecorderStart,
  mockMediaRecorderStop,
  mockReportError,
  mockStopAllTracks
} = await vi.hoisted(async () => {
  const { createExtensionCapture } =
    await import('@/utils/__tests__/extensionTestUtils')
  return {
    extensions: createExtensionCapture(),
    mockApiURL: vi.fn((url: string) => `api:${url}`),
    mockFetchApi: vi.fn(),
    mockMediaRecorderConstruct: vi.fn(),
    mockMediaRecorderStart: vi.fn(),
    mockMediaRecorderStop: vi.fn(),
    mockReportError: vi.fn(),
    mockStopAllTracks: vi.fn()
  }
})

let capturedDragDrop: ((files: File[]) => Promise<File[] | never[]>) | undefined
let capturedFileSelect:
  | ((files: File[]) => Promise<File[] | never[]>)
  | undefined
let capturedPaste: ((files: File[]) => Promise<File[] | never[]>) | undefined

vi.mock('extendable-media-recorder', () => ({
  MediaRecorder: class MockMediaRecorder {
    start = mockMediaRecorderStart
    stop = mockMediaRecorderStop

    constructor() {
      mockMediaRecorderConstruct()
    }
  }
}))

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mockReportError
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

let mockAddAlert: ReturnType<typeof useToastStore>['addAlert']
beforeEach(() => {
  mockAddAlert = useToastStore().addAlert
})

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
    registerExtension: extensions.registerExtension,
    rootGraph: { id: 'root' }
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByLocatorId: vi.fn()
}))

vi.mock('@/services/audioService', () => ({
  useAudioService: () => ({ stopAllTracks: mockStopAllTracks })
}))

await import('./uploadAudio')

async function getCustomWidget(extensionName: string, widgetName: string) {
  const extension = extensions.getExtension(extensionName)
  if (!extension.getCustomWidgets) {
    throw new Error(`${extensionName} does not register custom widgets`)
  }
  const widgets = await extension.getCustomWidgets(fromAny({}))
  const widget = widgets[widgetName]
  if (!widget) throw new Error(`${widgetName} widget was not registered`)
  return widget
}

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
  const uploadWidget = { label: '', serialize: true }
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
  const widget = await getCustomWidget('Comfy.UploadAudio', 'AUDIOUPLOAD')
  return (node: LGraphNode, inputName: string) =>
    widget(node, inputName, fromAny({}), fromAny({}))
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

async function loadAudioUIWidget() {
  const widget = await getCustomWidget('Comfy.AudioWidget', 'AUDIO_UI')
  return (node: LGraphNode, inputName: string) =>
    widget(node, inputName, fromAny({}), fromAny({}))
}

describe('Comfy.AudioWidget AUDIO_UI widget', () => {
  it('excludes the audio player from workflow and prompt serialization', async () => {
    const AUDIO_UI = await loadAudioUIWidget()
    const domWidget = {
      serialize: true,
      options: { serialize: true }
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

async function loadAudioRecordWidget() {
  const widget = await getCustomWidget('Comfy.RecordAudio', 'AUDIO_RECORD')
  return (node: LGraphNode, inputName: string) =>
    widget(node, inputName, fromAny({}), fromAny({}))
}

const RECORDER_FAILURE_REPORT = {
  errorType: 'failure_starting_audio_recorder',
  tags: {
    failure_kind: 'caught_unexpected',
    feature_area: 'assets',
    operation: 'execute',
    outcome: 'recovered'
  },
  level: 'error'
}

async function pressRecord() {
  const AUDIO_RECORD = await loadAudioRecordWidget()
  const audioUIWidget = {
    element: document.createElement('audio'),
    options: { canvasOnly: true }
  }
  const recordWidget = { label: '', type: '' }
  let record: (() => Promise<void>) | undefined
  const node = fromAny<LGraphNode, unknown>({
    addDOMWidget: vi.fn(() => audioUIWidget),
    addWidget: vi.fn((_type, _name, _value, callback: () => Promise<void>) => {
      record = callback
      return recordWidget
    })
  })
  AUDIO_RECORD(node, 'record')

  if (!record) throw new Error('Record callback was not registered')
  await record()

  return recordWidget
}

describe('Comfy.RecordAudio AUDIO_RECORD widget', () => {
  it('starts recording without reporting a failure', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({}) }
    })

    const recordWidget = await pressRecord()

    expect(mockMediaRecorderConstruct).toHaveBeenCalledTimes(1)
    expect(mockMediaRecorderStart).toHaveBeenCalledTimes(1)
    expect(recordWidget.label).toBe('g.stopRecording')
    expect(mockReportError).not.toHaveBeenCalled()
    expect(mockAddAlert).not.toHaveBeenCalled()
  })

  it('reports a recorder start failure after the microphone was granted', async () => {
    const accessError = new Error('recorder start failed')
    mockMediaRecorderStart.mockImplementationOnce(() => {
      throw accessError
    })
    mockMediaRecorderStop.mockImplementationOnce(() => {
      throw new Error('recorder stop failed')
    })
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({}) }
    })

    await pressRecord()

    expect(mockReportError).toHaveBeenCalledTimes(1)
    expect(mockReportError).toHaveBeenCalledWith(
      accessError,
      RECORDER_FAILURE_REPORT
    )
    expect(mockMediaRecorderStop).toHaveBeenCalledTimes(1)
  })

  it('reports a recorder construction failure and releases the granted stream', async () => {
    const constructionError = new Error('mime type unsupported')
    mockMediaRecorderConstruct.mockImplementationOnce(() => {
      throw constructionError
    })
    const stream = { id: 'granted-stream' }
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) }
    })

    const recordWidget = await pressRecord()

    expect(mockReportError).toHaveBeenCalledTimes(1)
    expect(mockReportError).toHaveBeenCalledWith(
      constructionError,
      RECORDER_FAILURE_REPORT
    )
    expect(mockStopAllTracks).toHaveBeenCalledWith(stream)
    expect(mockAddAlert).toHaveBeenCalledWith('g.recordingFailedToStart')
    expect(mockAddAlert).not.toHaveBeenCalledWith('g.micPermissionDenied')
    expect(recordWidget.label).toBe('g.startRecording')
  })

  it('treats a rejected getUserMedia as a permission denial rather than a fault', async () => {
    const permissionError = new DOMException(
      'Permission denied',
      'NotAllowedError'
    )
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(permissionError)
      }
    })

    await pressRecord()

    expect(mockAddAlert).toHaveBeenCalledWith('g.micPermissionDenied')
    expect(mockReportError).not.toHaveBeenCalled()
    expect(mockMediaRecorderConstruct).not.toHaveBeenCalled()
  })

  it('reports a non-permission getUserMedia failure', async () => {
    const accessError = new DOMException('No microphone found', 'NotFoundError')
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(accessError) }
    })

    await pressRecord()

    expect(mockReportError).toHaveBeenCalledWith(
      accessError,
      RECORDER_FAILURE_REPORT
    )
    expect(mockAddAlert).toHaveBeenCalledWith('g.recordingFailedToStart')
    expect(mockAddAlert).not.toHaveBeenCalledWith('g.micPermissionDenied')
    expect(mockMediaRecorderConstruct).not.toHaveBeenCalled()
  })
})
