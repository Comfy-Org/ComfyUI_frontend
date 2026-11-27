import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { DeploymentModelUploadPart } from '@/platform/workspace/api/workspaceApi'

import { deploymentModelUploadApi } from './deploymentModelUploadApi'

const BLOB_ID = 'blob-7f3a9c2e'
const MODEL_ID = 'model-41c2'
const target = { workspaceId: 'ws-1', deploymentId: 'dep-1' }
const PIECE_BYTES = 10

class StorageRequest {
  static sent: StorageRequest[] = []
  static peakInFlight = 0
  method = ''
  url = ''
  body: Blob | undefined
  status = 0
  done = false
  upload: { onprogress: ((event: { loaded: number }) => void) | null } = {
    onprogress: null
  }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null
  onabort: (() => void) | null = null
  onloadend: (() => void) | null = null

  static inFlight() {
    return StorageRequest.sent.filter((request) => !request.done)
  }
  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  send(body: Blob) {
    this.body = body
    StorageRequest.sent.push(this)
    StorageRequest.peakInFlight = Math.max(
      StorageRequest.peakInFlight,
      StorageRequest.inFlight().length
    )
  }
  abort() {
    this.done = true
    this.onabort?.()
    this.onloadend?.()
  }
  finish(status: number) {
    this.done = true
    this.status = status
    this.onload?.()
    this.onloadend?.()
  }
}

function linkExpiresIn(ms: number) {
  return new Date(Date.now() + ms).toISOString()
}

function piece(
  partNumber: number,
  url = `https://storage.example.com/blob-7f3a9c2e/${partNumber}?sig=a`,
  expiresAt = linkExpiresIn(15 * 60_000)
): DeploymentModelUploadPart {
  return {
    partNumber,
    offsetBytes: (partNumber - 1) * PIECE_BYTES,
    sizeBytes: PIECE_BYTES,
    uploadUrl: url,
    expiresAt
  }
}

function modelFile(pieces: number) {
  const bytes = new Uint8Array(pieces * PIECE_BYTES)
  for (let i = 0; i < bytes.length; i++) bytes[i] = 65 + (i % 26)
  return new File([bytes], 'my_style_v2.safetensors')
}

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

function ingestAnswers(parts: DeploymentModelUploadPart[]) {
  const calls: string[] = []
  const create = vi
    .spyOn(workspaceApi, 'createDeploymentModelUpload')
    .mockImplementation(async () => {
      calls.push('create')
      return { blobId: BLOB_ID, deduplicated: false, parts }
    })
  const add = vi
    .spyOn(workspaceApi, 'addDeploymentModel')
    .mockImplementation(async () => {
      calls.push(`add after ${StorageRequest.sent.length} pieces`)
      return {
        id: MODEL_ID,
        filename: 'my_style_v2.safetensors',
        status: 'adding'
      }
    })
  const renew = vi
    .spyOn(workspaceApi, 'refreshDeploymentModelUploadParts')
    .mockResolvedValue(parts)
  const complete = vi
    .spyOn(workspaceApi, 'completeDeploymentModelUpload')
    .mockImplementation(async () => {
      calls.push(`complete after ${StorageRequest.sent.length} pieces`)
    })
  const remove = vi
    .spyOn(workspaceApi, 'removeDeploymentModel')
    .mockResolvedValue(undefined)
  return { calls, create, add, renew, complete, remove }
}

function upload(file: File, signal = new AbortController().signal) {
  const onProgress = vi.fn()
  const onSending = vi.fn()
  const result = deploymentModelUploadApi.uploadModelToDeployment(
    file,
    target,
    { type: 'loras', signal, onSending, onProgress }
  )
  return { result, onProgress, onSending }
}

async function finishNext(status = 200) {
  await vi.waitFor(() =>
    expect(StorageRequest.inFlight().length).toBeGreaterThan(0)
  )
  const [next] = StorageRequest.inFlight()
  next.finish(status)
  return next
}

describe('deploymentModelUploadApi.uploadModelToDeployment', () => {
  beforeEach(() => {
    StorageRequest.sent = []
    StorageRequest.peakInFlight = 0
    vi.stubGlobal('XMLHttpRequest', StorageRequest)
  })

  it('adds the upload to the deployment before the first piece, sends the pieces eight at a time, then joins them', async () => {
    const file = modelFile(10)
    const parts = Array.from({ length: 10 }, (_, i) => piece(i + 1))
    const ingest = ingestAnswers(parts)

    const { result, onProgress, onSending } = upload(file)
    for (let i = 0; i < parts.length; i++) await finishNext()

    await expect(result).resolves.toEqual({ ok: true, modelId: MODEL_ID })
    expect(onSending).toHaveBeenCalledOnce()
    expect(ingest.create).toHaveBeenCalledWith(
      'ws-1',
      'dep-1',
      {
        filename: 'my_style_v2.safetensors',
        sizeBytes: 100,
        sha256: await sha256Hex(file),
        parts: true
      },
      expect.any(AbortSignal)
    )
    expect(ingest.add).toHaveBeenCalledWith(
      'ws-1',
      'dep-1',
      { blobId: BLOB_ID, type: 'loras' },
      expect.any(AbortSignal)
    )
    expect(ingest.calls).toEqual([
      'create',
      'add after 0 pieces',
      'complete after 10 pieces'
    ])
    expect(ingest.complete).toHaveBeenCalledWith(
      'ws-1',
      'dep-1',
      BLOB_ID,
      expect.any(AbortSignal)
    )
    expect(StorageRequest.peakInFlight).toBe(8)
    expect(StorageRequest.sent.map((request) => request.url)).toEqual(
      parts.map((part) => part.uploadUrl)
    )
    expect(StorageRequest.sent.every((r) => r.method === 'PUT')).toBe(true)
    await expect(StorageRequest.sent[2].body?.text()).resolves.toBe(
      await file.slice(20, 30).text()
    )
    expect(onProgress).toHaveBeenLastCalledWith(100)
    expect(ingest.renew).not.toHaveBeenCalled()
    expect(ingest.remove).not.toHaveBeenCalled()
  })

  it('asks for fresh links when storage refuses an expired one, and resends only the pieces not stored yet', async () => {
    const file = modelFile(3)
    const ingest = ingestAnswers([piece(1), piece(2), piece(3)])
    const fresh2 = piece(2, 'https://storage.example.com/blob-7f3a9c2e/2?sig=b')
    const fresh3 = piece(3, 'https://storage.example.com/blob-7f3a9c2e/3?sig=b')
    ingest.renew.mockResolvedValue([fresh2, fresh3])

    const { result } = upload(file)
    await vi.waitFor(() => expect(StorageRequest.sent).toHaveLength(3))
    StorageRequest.sent[0].finish(200)
    StorageRequest.sent[1].finish(403)
    await vi.waitFor(() => expect(StorageRequest.sent).toHaveLength(4))
    StorageRequest.sent[2].finish(200)
    StorageRequest.sent[3].finish(200)

    await expect(result).resolves.toEqual({ ok: true, modelId: MODEL_ID })
    expect(ingest.renew).toHaveBeenCalledOnce()
    expect(ingest.renew).toHaveBeenCalledWith(
      'ws-1',
      'dep-1',
      BLOB_ID,
      expect.any(AbortSignal)
    )
    expect(StorageRequest.sent[3].url).toBe(fresh2.uploadUrl)
    expect(ingest.complete).toHaveBeenCalledOnce()
  })

  it('treats a refused piece the fresh links leave out as already stored', async () => {
    const ingest = ingestAnswers([piece(1)])
    ingest.renew.mockResolvedValue([])

    const { result } = upload(modelFile(1))
    await finishNext(403)

    await expect(result).resolves.toEqual({ ok: true, modelId: MODEL_ID })
    expect(StorageRequest.sent).toHaveLength(1)
    expect(ingest.complete).toHaveBeenCalledOnce()
  })

  it('renews links about to expire once, before sending those pieces', async () => {
    const soon = linkExpiresIn(30_000)
    const ingest = ingestAnswers([
      piece(1, 'https://storage.example.com/old/1', soon),
      piece(2, 'https://storage.example.com/old/2', soon)
    ])
    ingest.renew.mockResolvedValue([piece(1), piece(2)])

    const { result } = upload(modelFile(2))
    await finishNext()
    await finishNext()

    await expect(result).resolves.toEqual({ ok: true, modelId: MODEL_ID })
    expect(ingest.renew).toHaveBeenCalledOnce()
    expect(StorageRequest.sent.map((request) => request.url)).toEqual([
      piece(1).uploadUrl,
      piece(2).uploadUrl
    ])
  })

  it("passes comfy-deploy's sentence on a refused add and sends no piece", async () => {
    const ingest = ingestAnswers([piece(1)])
    const message = 'This deployment already has a model named my_style_v2.'
    ingest.add.mockRejectedValue(
      new WorkspaceApiError(message, 409, 'MODEL_NAME_TAKEN')
    )

    await expect(upload(modelFile(1)).result).resolves.toEqual({
      ok: false,
      reason: 'refused',
      message
    })
    expect(StorageRequest.sent).toHaveLength(0)
  })

  it('says the switch is off and sends no piece when the add answers so', async () => {
    const ingest = ingestAnswers([piece(1)])
    ingest.add.mockResolvedValue('notOn')

    await expect(upload(modelFile(1)).result).resolves.toEqual({
      ok: false,
      reason: 'notOn'
    })
    expect(StorageRequest.sent).toHaveLength(0)
    expect(ingest.complete).not.toHaveBeenCalled()
  })

  it("reads ingest's own 404 on the add as a failure, not the switch", async () => {
    const ingest = ingestAnswers([piece(1)])
    const refusal = new WorkspaceApiError(
      'Workspace not found.',
      404,
      'NOT_FOUND'
    )
    ingest.add.mockRejectedValue(refusal)

    await expect(upload(modelFile(1)).result).resolves.toEqual({
      ok: false,
      reason: 'failed',
      cause: refusal
    })
    expect(StorageRequest.sent).toHaveLength(0)
  })

  it('stops the pieces in flight and joins nothing once canceled', async () => {
    const ingest = ingestAnswers([piece(1), piece(2)])
    const controller = new AbortController()

    const { result } = upload(modelFile(2), controller.signal)
    await vi.waitFor(() => expect(StorageRequest.sent).toHaveLength(2))
    controller.abort()

    await expect(result).resolves.toEqual({ ok: false, reason: 'cancelled' })
    expect(StorageRequest.inFlight()).toHaveLength(0)
    expect(ingest.complete).not.toHaveBeenCalled()
    expect(ingest.remove).toHaveBeenCalledWith('ws-1', 'dep-1', MODEL_ID)
  })

  it('stops the other pieces once storage refuses one piece three times', async () => {
    const ingest = ingestAnswers([piece(1), piece(2)])

    const { result } = upload(modelFile(2))
    await vi.waitFor(() => expect(StorageRequest.sent).toHaveLength(2))
    StorageRequest.sent[0].finish(503)
    await vi.waitFor(() => expect(StorageRequest.sent).toHaveLength(3))
    StorageRequest.sent[2].finish(503)
    await vi.waitFor(() => expect(StorageRequest.sent).toHaveLength(4))
    StorageRequest.sent[3].finish(503)

    await expect(result).resolves.toEqual({
      ok: false,
      reason: 'failed',
      cause: 'storage 503'
    })
    expect(ingest.renew).toHaveBeenCalledTimes(2)
    expect(StorageRequest.sent[1].done).toBe(true)
    expect(ingest.complete).not.toHaveBeenCalled()
    expect(ingest.remove).toHaveBeenCalledWith('ws-1', 'dep-1', MODEL_ID)
  })

  it("passes the join's refusal sentence on", async () => {
    const ingest = ingestAnswers([piece(1)])
    const message = 'Piece 1 is missing.'
    ingest.complete.mockRejectedValue(
      new WorkspaceApiError(message, 409, 'PART_MISSING')
    )

    const { result } = upload(modelFile(1))
    await finishNext()

    await expect(result).resolves.toEqual({
      ok: false,
      reason: 'refused',
      message
    })
    expect(ingest.remove).toHaveBeenCalledWith('ws-1', 'dep-1', MODEL_ID)
  })

  it('reads no piece and adds nothing once canceled while the file is read', async () => {
    const ingest = ingestAnswers([piece(1)])
    const controller = new AbortController()
    controller.abort()

    await expect(
      upload(modelFile(1), controller.signal).result
    ).resolves.toEqual({ ok: false, reason: 'cancelled' })
    expect(ingest.create).not.toHaveBeenCalled()
    expect(ingest.add).not.toHaveBeenCalled()
  })
})

describe('deploymentModelUploadApi.waitForDeploymentModel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  function entry(status: string) {
    return { id: MODEL_ID, filename: 'my_style_v2.safetensors', status }
  }

  it.for([
    { status: 'ready', outcome: 'ready' },
    { status: 'failed', outcome: 'failed' },
    { status: 'removing', outcome: 'gone' }
  ])(
    'reads the list until the file leaves adding, then answers $outcome',
    async ({ status, outcome }) => {
      const list = vi
        .spyOn(workspaceApi, 'listDeploymentModels')
        .mockResolvedValueOnce([entry('adding')])
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce([entry(status)])

      const answer = deploymentModelUploadApi.waitForDeploymentModel(
        target,
        MODEL_ID,
        new AbortController().signal
      )
      await vi.advanceTimersByTimeAsync(6_000)

      await expect(answer).resolves.toBe(outcome)
      expect(list).toHaveBeenCalledTimes(3)
      expect(list).toHaveBeenCalledWith(
        'ws-1',
        'dep-1',
        expect.any(AbortSignal)
      )
    }
  )

  it('answers gone once the list no longer has the file', async () => {
    vi.spyOn(workspaceApi, 'listDeploymentModels').mockResolvedValue([])

    await expect(
      deploymentModelUploadApi.waitForDeploymentModel(
        target,
        MODEL_ID,
        new AbortController().signal
      )
    ).resolves.toBe('gone')
  })

  it('stops reading once the signal aborts', async () => {
    const list = vi
      .spyOn(workspaceApi, 'listDeploymentModels')
      .mockResolvedValue([entry('adding')])
    const controller = new AbortController()

    const answer = deploymentModelUploadApi.waitForDeploymentModel(
      target,
      MODEL_ID,
      controller.signal
    )
    await vi.advanceTimersByTimeAsync(0)
    controller.abort()

    await expect(answer).resolves.toBeUndefined()
    expect(list).toHaveBeenCalledOnce()
  })
})
