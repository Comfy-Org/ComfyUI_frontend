import { useToast } from '@/components/ui/toast/toastStore'
import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeImageUpload } from '@/composables/node/useNodeImageUpload'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ResultItem } from '@comfyorg/api-client/executionTypes'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/platform/assets/stores/assetsStore'
import type { Mock } from 'vitest'

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

vi.mock(import('@/i18n'))

vi.mock(import('@/scripts/api'))

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

const TWO_AND_A_HALF_MIB = 2_621_440

function createFileOfBytes(name: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/png' })
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
    vi.mocked(api.fetchApi).mockResolvedValueOnce(successResponse('image.png'))
    const file = createFile('image.png')

    await handleUpload(file)

    const body = vi.mocked(api.fetchApi).mock.calls[0][1]?.body
    if (!(body instanceof FormData)) {
      throw new Error('Image upload must send multipart form data')
    }
    expect(Object.fromEntries(body.entries())).toEqual({
      image: file,
      type: 'output'
    })
  })

  it('budgets a single direct upload by its own size', async () => {
    const { handleUpload } = useNodeImageUpload(node, { onUploadComplete })
    vi.mocked(api.fetchApi).mockResolvedValueOnce(successResponse('a.png'))

    await handleUpload(createFileOfBytes('a.png', TWO_AND_A_HALF_MIB))

    expect(vi.mocked(api.fetchApi).mock.calls[0][1]?.timeoutMs).toBe(130_000)
  })

  it.for([
    { mediaType: 'image', filename: 'test.png', mimeType: 'image/png' },
    { mediaType: 'video', filename: 'clip.mp4', mimeType: 'video/mp4' }
  ])(
    'sets isUploading true during $mediaType upload and false after',
    async ({ filename, mimeType }) => {
      vi.mocked(api.fetchApi).mockResolvedValueOnce(successResponse(filename))

      const promise = capturedDragOnDrop([createFile(filename, mimeType)])
      expect(node.isUploading).toBe(true)

      await promise
      expect(node.isUploading).toBe(false)
    }
  )

  it('clears node.imgs on upload start', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(successResponse('test.png'))

    const promise = capturedDragOnDrop([createFile()])
    expect(node.imgs).toBeUndefined()

    await promise
  })

  it('calls onUploadStart with files', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(successResponse('test.png'))
    const files = [createFile()]

    await capturedDragOnDrop(files)
    expect(onUploadStart).toHaveBeenCalledWith(files)
  })

  it('invalidates input assets and only then calls onUploadComplete on success', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(successResponse('test.png'))
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
  })

  it('gives each concurrent upload in a drop the response timeout of the whole batch', async () => {
    vi.mocked(api.fetchApi).mockImplementation(async () =>
      successResponse('a.png')
    )

    await capturedDragOnDrop([
      createFileOfBytes('a.png', TWO_AND_A_HALF_MIB),
      createFileOfBytes('b.png', TWO_AND_A_HALF_MIB)
    ])

    expect(
      vi.mocked(api.fetchApi).mock.calls.map(([, init]) => init?.timeoutMs)
    ).toEqual([140_000, 140_000])
  })

  describe('when the server stalls', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.mocked(api.fetchApi).mockImplementation(
        (_route, init) =>
          new Promise((_resolve, reject) =>
            setTimeout(
              () => reject(new DOMException('Fetch timeout', 'TimeoutError')),
              init?.timeoutMs ?? undefined
            )
          )
      )
    })

    it('waits out the batch budget, then reports a timeout and frees the node', async () => {
      const drop = capturedDragOnDrop([
        createFileOfBytes('a.png', TWO_AND_A_HALF_MIB),
        createFileOfBytes('b.png', TWO_AND_A_HALF_MIB)
      ])

      await vi.advanceTimersByTimeAsync(139_999)
      expect(node.isUploading).toBe(true)
      expect(useToast().warning).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(await drop).toEqual([])
      expect(node.isUploading).toBe(false)
      expect(useToast().warning).toHaveBeenCalledTimes(2)
      expect(useToast().warning).toHaveBeenCalledWith('g.uploadTimedOut')
      expect(onUploadError).toHaveBeenCalledOnce()
    })
  })

  it('includes subfolder in returned path', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      successResponse('test.png', 'pasted')
    )

    await capturedDragOnDrop([createFile()])
    expect(onUploadComplete).toHaveBeenCalledWith(['pasted/test.png'])
  })

  it('calls onUploadError when all uploads fail', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(failResponse())

    await capturedDragOnDrop([createFile()])
    expect(onUploadError).toHaveBeenCalled()
    expect(onUploadComplete).not.toHaveBeenCalled()
  })

  it('shows a file-too-large toast on a 413 with no known upload limit', async () => {
    vi.mocked(api.getServerFeature).mockReturnValue(undefined)
    vi.mocked(api.fetchApi).mockResolvedValueOnce(failResponse(413))

    await capturedDragOnDrop([createFile()])

    expect(t).toHaveBeenCalledWith('g.uploadFileTooLarge')
    expect(useToast().warning).toHaveBeenCalledWith('g.uploadFileTooLarge')
  })

  it('shows a file-too-large toast with the limit on a 413 when the server reports one', async () => {
    vi.mocked(api.getServerFeature).mockReturnValue(104_857_600)
    vi.mocked(api.fetchApi).mockResolvedValueOnce(failResponse(413))

    await capturedDragOnDrop([createFile()])

    expect(t).toHaveBeenCalledWith('g.uploadFileTooLargeWithLimit', {
      limit: 100
    })
  })

  it('shows a status-derived toast without a dangling separator for other failures', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: '' })
    )

    await capturedDragOnDrop([createFile()])

    expect(t).toHaveBeenCalledWith('g.uploadFailed', {
      reason: 'HTTP 500'
    })
  })

  it('shows a localized upload-failed toast when the upload throws', async () => {
    vi.mocked(api.fetchApi).mockRejectedValueOnce(new Error('Network error'))

    await capturedDragOnDrop([createFile()])

    expect(t).toHaveBeenCalledWith('g.uploadFailed', {
      reason: 'Network error'
    })
    expect(useToast().toasts).toEqual([
      expect.objectContaining({ kind: 'warning', title: 'g.uploadFailed' })
    ])
  })

  it('resets isUploading even when upload fails', async () => {
    vi.mocked(api.fetchApi).mockRejectedValueOnce(new Error('Network error'))

    await capturedDragOnDrop([createFile()])
    expect(node.isUploading).toBe(false)
  })

  it('rejects concurrent uploads with a toast', async () => {
    vi.mocked(api.fetchApi).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(successResponse('a.png')), 50)
        )
    )

    const first = capturedDragOnDrop([createFile('a.png')])
    const second = await capturedDragOnDrop([createFile('b.png')])

    expect(second).toEqual([])
    expect(useToast().warning).toHaveBeenCalledWith('g.uploadAlreadyInProgress')

    await first
  })

  it('calls setDirtyCanvas on start and finish', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(successResponse('test.png'))

    await capturedDragOnDrop([createFile()])
    expect(node.graph?.setDirtyCanvas).toHaveBeenCalledTimes(2)
  })
})
