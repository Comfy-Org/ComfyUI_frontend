import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ResultItem, ResultItemType } from '@/schemas/apiSchema'

const { mockFetchApi, mockAddAlert, mockUpdateInputs } = vi.hoisted(() => ({
  mockFetchApi: vi.fn(),
  mockAddAlert: vi.fn(),
  mockUpdateInputs: vi.fn()
}))

let capturedDragOnDrop: (files: File[]) => Promise<string[]>
let capturedResultItemDrop: (item: ResultItem) => void
let capturedPasteOnPaste: (files: File[]) => Promise<string[]>
let capturedFileInputOnSelect: (files: File[]) => Promise<string[]>
const mockOpenFileSelection = vi.fn()

vi.mock('@/composables/node/useNodeDragAndDrop', () => ({
  useNodeDragAndDrop: (
    _node: LGraphNode,
    opts: {
      onDrop: typeof capturedDragOnDrop
      onResultItemDrop: typeof capturedResultItemDrop
    }
  ) => {
    capturedDragOnDrop = opts.onDrop
    capturedResultItemDrop = opts.onResultItemDrop
  }
}))

vi.mock('@/composables/node/useNodeFileInput', () => ({
  useNodeFileInput: (
    _node: LGraphNode,
    opts: { onSelect: typeof capturedFileInputOnSelect }
  ) => {
    capturedFileInputOnSelect = opts.onSelect
    return { openFileSelection: mockOpenFileSelection }
  }
}))

vi.mock('@/composables/node/useNodePaste', () => ({
  useNodePaste: (
    _node: LGraphNode,
    opts: { onPaste: typeof capturedPasteOnPaste }
  ) => {
    capturedPasteOnPaste = opts.onPaste
  }
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert: mockAddAlert })
}))

vi.mock('@/scripts/api', () => ({
  api: { fetchApi: mockFetchApi }
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({ updateInputs: mockUpdateInputs })
}))

function createMockNode(): LGraphNode {
  const node = fromPartial<LGraphNode>({
    isUploading: false,
    graph: { setDirtyCanvas: vi.fn() },
    size: [300, 400],
    constructor: {}
  })
  node.imgs = [new Image()]
  return node
}

function createFile(name = 'test.png', type = 'image/png'): File {
  return new File(['data'], name, { type })
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

describe('useNodeImageUpload', () => {
  let node: LGraphNode
  let onUploadComplete: (paths: (string | ResultItem)[]) => void
  let onUploadStart: (files: File[]) => void
  let onUploadError: () => void

  async function mountImageUpload(
    options: { folder?: ResultItemType } = { folder: 'input' }
  ) {
    const { useNodeImageUpload } = await import('./useNodeImageUpload')
    return useNodeImageUpload(node, {
      onUploadComplete,
      onUploadStart,
      onUploadError,
      ...options
    })
  }

  function lastUploadBody() {
    const body = mockFetchApi.mock.calls.at(-1)?.[1]?.body
    if (!(body instanceof FormData)) {
      throw new Error('Expected upload body to be FormData')
    }
    return body
  }

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    node = createMockNode()
    onUploadComplete = vi.fn()
    onUploadStart = vi.fn()
    onUploadError = vi.fn()

    await mountImageUpload()
  })

  it.for([
    { mediaType: 'image', filename: 'test.png', mimeType: 'image/png' },
    { mediaType: 'video', filename: 'clip.mp4', mimeType: 'video/mp4' }
  ])(
    'sets isUploading true during $mediaType upload and false after',
    async ({ filename, mimeType }) => {
      mockFetchApi.mockResolvedValueOnce(successResponse(filename))

      const promise = capturedDragOnDrop([createFile(filename, mimeType)])
      expect(node.isUploading).toBe(true)

      await promise
      expect(node.isUploading).toBe(false)
    }
  )

  it('clears node.imgs on upload start', async () => {
    mockFetchApi.mockResolvedValueOnce(successResponse('test.png'))

    const promise = capturedDragOnDrop([createFile()])
    expect(node.imgs).toBeUndefined()

    await promise
  })

  it('calls onUploadStart with files', async () => {
    mockFetchApi.mockResolvedValueOnce(successResponse('test.png'))
    const files = [createFile()]

    await capturedDragOnDrop(files)
    expect(onUploadStart).toHaveBeenCalledWith(files)
  })

  it('calls onUploadComplete with valid paths on success', async () => {
    mockFetchApi.mockResolvedValueOnce(successResponse('test.png'))

    await capturedDragOnDrop([createFile()])
    expect(onUploadComplete).toHaveBeenCalledWith(['test.png'])
  })

  it('includes subfolder in returned path', async () => {
    mockFetchApi.mockResolvedValueOnce(successResponse('test.png', 'pasted'))

    await capturedDragOnDrop([createFile()])
    expect(onUploadComplete).toHaveBeenCalledWith(['pasted/test.png'])
  })

  it('calls onUploadError when all uploads fail', async () => {
    mockFetchApi.mockResolvedValueOnce(failResponse())

    await capturedDragOnDrop([createFile()])
    expect(onUploadError).toHaveBeenCalled()
    expect(onUploadComplete).not.toHaveBeenCalled()
  })

  it('resets isUploading even when upload fails', async () => {
    mockFetchApi.mockRejectedValueOnce(new Error('Network error'))

    await capturedDragOnDrop([createFile()])
    expect(node.isUploading).toBe(false)
  })

  it('rejects concurrent uploads with a toast', async () => {
    mockFetchApi.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(successResponse('a.png')), 50)
        )
    )

    const first = capturedDragOnDrop([createFile('a.png')])
    const second = await capturedDragOnDrop([createFile('b.png')])

    expect(second).toEqual([])
    expect(mockAddAlert).toHaveBeenCalledWith('g.uploadAlreadyInProgress')

    await first
  })

  it('calls setDirtyCanvas on start and finish', async () => {
    mockFetchApi.mockResolvedValueOnce(successResponse('test.png'))

    await capturedDragOnDrop([createFile()])
    expect(node.graph?.setDirtyCanvas).toHaveBeenCalledTimes(2)
  })

  it('passes dropped result items through without uploading', () => {
    const resultItem = fromPartial<ResultItem>({
      filename: 'existing.png',
      subfolder: '',
      type: 'input'
    })

    capturedResultItemDrop(resultItem)

    expect(onUploadComplete).toHaveBeenCalledWith([resultItem])
    expect(mockFetchApi).not.toHaveBeenCalled()
  })

  it('uploads pasted images to the pasted subfolder', async () => {
    const { handleUpload } = await mountImageUpload({})
    mockFetchApi.mockResolvedValueOnce(successResponse('image.png'))

    await handleUpload(createFile('image.png'))

    const body = lastUploadBody()
    expect(body.get('subfolder')).toBe('pasted')
    expect(body.get('type')).toBeNull()
    expect(mockUpdateInputs).not.toHaveBeenCalled()
  })

  it('refreshes input assets for default non-pasted uploads', async () => {
    const { handleUpload } = await mountImageUpload({})
    mockFetchApi.mockResolvedValueOnce(successResponse('upload.png'))

    await handleUpload(createFile('upload.png'))

    const body = lastUploadBody()
    expect(body.get('subfolder')).toBeNull()
    expect(body.get('type')).toBeNull()
    expect(mockUpdateInputs).toHaveBeenCalledOnce()
  })

  it('does not refresh input assets for explicit output uploads', async () => {
    await mountImageUpload({ folder: 'output' })
    mockFetchApi.mockResolvedValueOnce(successResponse('output.png'))

    await capturedFileInputOnSelect([createFile('output.png')])

    const body = lastUploadBody()
    expect(body.get('type')).toBe('output')
    expect(mockUpdateInputs).not.toHaveBeenCalled()
  })

  it('shows a specific alert for upload timeouts', async () => {
    mockFetchApi.mockRejectedValueOnce(new DOMException('', 'TimeoutError'))

    await capturedPasteOnPaste([createFile()])

    expect(mockAddAlert).toHaveBeenCalledWith('g.uploadTimedOut')
  })
})
