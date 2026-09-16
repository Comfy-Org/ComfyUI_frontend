import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeImageUpload } from '@/composables/node/useNodeImageUpload'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ResultItem } from '@/platform/remote/comfyui/execution/types'
import type { api } from '@/scripts/api'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAssetsStore } from '@/stores/assetsStore'
import type { Mock } from 'vitest'

const mockFetchApi = vi.hoisted(() => vi.fn<typeof api.fetchApi>())
const mockGetServerFeature = vi.hoisted(() => vi.fn())
const mockT = vi.hoisted(() => vi.fn((key: string, _params?: unknown) => key))
let mockInvalidateInputs: Mock<
  ReturnType<typeof useAssetsStore>['inputAssets']['invalidate']
>

let capturedDragOnDrop: (files: File[]) => Promise<string[]>

vi.mock<unknown>(import('@/composables/node/useNodeDragAndDrop'), () => ({
  useNodeDragAndDrop: (
    _node: LGraphNode,
    opts: { onDrop: typeof capturedDragOnDrop }
  ) => {
    capturedDragOnDrop = opts.onDrop
  }
}))

vi.mock(import('@/composables/node/useNodeFileInput'), () => ({
  useNodeFileInput: () => ({ openFileSelection: vi.fn() })
}))

vi.mock(import('@/composables/node/useNodePaste'), () => ({
  useNodePaste: vi.fn()
}))

vi.mock(import('@/i18n'), () => ({
  t: mockT
}))

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    fetchApi: mockFetchApi,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getServerFeature: mockGetServerFeature
  }
}))

function createMockNode(): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    isUploading: false,
    imgs: [new Image()],
    graph: { setDirtyCanvas: vi.fn() },
    size: [300, 400]
  })
}

function createFile(name = 'test.png', type = 'image/png'): File {
  return new File(['data'], name, { type })
}

function successResponse(name: string, subfolder?: string) {
  return Response.json({ name, subfolder })
}

function failResponse(status = 500) {
  return new Response(null, {
    status,
    statusText: 'Server Error'
  })
}

describe('useNodeImageUpload', () => {
  let node: LGraphNode
  let onUploadComplete: (paths: (string | ResultItem)[]) => void
  let onUploadStart: (files: File[]) => void
  let onUploadError: () => void

  beforeEach(() => {
    mockGetServerFeature.mockReset()
    mockT.mockClear()
    mockInvalidateInputs = vi
      .spyOn(useAssetsStore().inputAssets, 'invalidate')
      .mockResolvedValue(undefined)
    node = createMockNode()
    onUploadComplete = vi.fn()
    onUploadStart = vi.fn()
    onUploadError = vi.fn()

    useNodeImageUpload(node, {
      onUploadComplete,
      onUploadStart,
      onUploadError,
      folder: 'input'
    })
  })

  it('uploads image.png with the configured destination', async () => {
    const { handleUpload } = useNodeImageUpload(node, {
      folder: 'output',
      onUploadComplete
    })
    mockFetchApi.mockResolvedValueOnce(successResponse('image.png'))
    const file = createFile('image.png')

    await handleUpload(file)

    const body = mockFetchApi.mock.calls[0][1]?.body
    if (!(body instanceof FormData)) {
      throw new Error('Image upload must send multipart form data')
    }
    expect(Object.fromEntries(body.entries())).toEqual({
      image: file,
      type: 'output'
    })
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

  it('invalidates input assets and only then calls onUploadComplete on success', async () => {
    mockFetchApi.mockResolvedValueOnce(successResponse('test.png'))
    let invalidateResolve!: () => void
    mockInvalidateInputs.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          invalidateResolve = resolve
        })
    )

    const drop = capturedDragOnDrop([createFile()])
    await vi.waitFor(() =>
      expect(mockInvalidateInputs).toHaveBeenCalledTimes(1)
    )
    expect(onUploadComplete).not.toHaveBeenCalled()

    invalidateResolve()
    await drop
    expect(onUploadComplete).toHaveBeenCalledWith(['test.png'])
    expect(mockFetchApi).toHaveBeenCalledWith(
      '/upload/image',
      expect.objectContaining({ timeoutMs: 120_000 })
    )
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

  it('shows a file-too-large toast on a 413 with no known upload limit', async () => {
    mockGetServerFeature.mockReturnValue(undefined)
    mockFetchApi.mockResolvedValueOnce(failResponse(413))

    await capturedDragOnDrop([createFile()])

    expect(mockT).toHaveBeenCalledWith('g.uploadFileTooLarge')
    expect(useToastStore().addAlert).toHaveBeenCalledWith(
      'g.uploadFileTooLarge'
    )
  })

  it('shows a file-too-large toast with the limit on a 413 when the server reports one', async () => {
    mockGetServerFeature.mockReturnValue(104_857_600)
    mockFetchApi.mockResolvedValueOnce(failResponse(413))

    await capturedDragOnDrop([createFile()])

    expect(mockT).toHaveBeenCalledWith('g.uploadFileTooLargeWithLimit', {
      limit: 100
    })
  })

  it('shows a status-derived toast without a dangling separator for other failures', async () => {
    mockFetchApi.mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: '' })
    )

    await capturedDragOnDrop([createFile()])

    expect(mockT).toHaveBeenCalledWith('g.uploadFailed', {
      reason: 'HTTP 500'
    })
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
    expect(useToastStore().addAlert).toHaveBeenCalledWith(
      'g.uploadAlreadyInProgress'
    )

    await first
  })

  it('calls setDirtyCanvas on start and finish', async () => {
    mockFetchApi.mockResolvedValueOnce(successResponse('test.png'))

    await capturedDragOnDrop([createFile()])
    expect(node.graph?.setDirtyCanvas).toHaveBeenCalledTimes(2)
  })
})
