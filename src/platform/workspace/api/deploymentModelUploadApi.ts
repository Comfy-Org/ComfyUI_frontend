import { sum } from 'es-toolkit'

import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import { fileSha256 } from '@/platform/workspace/api/fileSha256'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type {
  DeploymentModelEntry,
  DeploymentModelUploadPart
} from '@/platform/workspace/api/workspaceApi'
import type { WorkspaceId } from '@/platform/workspace/workspaceTypes'

const PARALLEL_PUTS = 8
const PUT_ATTEMPTS = 3
const LINK_RENEW_MARGIN_MS = 60_000
const LIST_POLL_MS = 3_000
const JOIN_ATTEMPTS = 2

export interface DeploymentModelTarget {
  workspaceId: WorkspaceId
  deploymentId: string
}

export type DeploymentModelUploadResult =
  | { ok: true; modelId: string }
  | {
      ok: false
      reason: 'notOn' | 'refused' | 'cancelled' | 'failed'
      message?: string
      cause?: unknown
      modelId?: string
      stillListed?: true
    }

type UploadStopped = Extract<DeploymentModelUploadResult, { ok: false }>

export type DeploymentModelOutcome = 'ready' | 'failed' | 'gone'

interface DeploymentModelUploadOptions {
  type: string
  signal: AbortSignal
  freshUpload?: boolean
  onSending: () => void
  onProgress: (sentBytes: number) => void
}

function putPiece(
  url: string,
  body: Blob,
  signal: AbortSignal,
  onProgress: (loaded: number) => void
): Promise<number> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest()
    const abort = () => request.abort()
    request.upload.onprogress = (event) => onProgress(event.loaded)
    request.onload = () => resolve(request.status)
    request.onerror = request.ontimeout = request.onabort = () => resolve(0)
    request.onloadend = () => signal.removeEventListener('abort', abort)
    if (signal.aborted) return resolve(0)
    signal.addEventListener('abort', abort, { once: true })
    request.open('PUT', url)
    request.setRequestHeader('x-goog-if-generation-match', '0')
    request.send(body)
  })
}

async function putPieces(
  file: File,
  parts: readonly DeploymentModelUploadPart[],
  renew: () => Promise<DeploymentModelUploadPart[]>,
  { signal, onProgress }: DeploymentModelUploadOptions
): Promise<string | undefined> {
  const links = new Map(parts.map((part) => [part.partNumber, part]))
  const queue = [...links.keys()]
  const sent = new Map<number, number>()
  const halt = new AbortController()
  const forwardAbort = () => halt.abort()
  signal.addEventListener('abort', forwardAbort, { once: true })
  let renewing: Promise<Set<number>> | undefined
  let stopped: string | undefined

  function report(partNumber: number, bytes: number) {
    sent.set(partNumber, bytes)
    onProgress(sum([...sent.values()]))
  }

  function renewLinks(): Promise<Set<number>> {
    renewing ??= renew()
      .then((fresh) => {
        for (const part of fresh) links.set(part.partNumber, part)
        return new Set(fresh.map((part) => part.partNumber))
      })
      .finally(() => {
        renewing = undefined
      })
    return renewing
  }

  async function linkFor(partNumber: number, renewNow: boolean) {
    const link = links.get(partNumber)
    const expiring =
      !link || Date.parse(link.expiresAt) - Date.now() < LINK_RENEW_MARGIN_MS
    if (!renewNow && !expiring) return link
    const unstored = await renewLinks()
    return unstored.has(partNumber) ? links.get(partNumber) : undefined
  }

  function putLink(partNumber: number, link: DeploymentModelUploadPart) {
    const { offsetBytes, sizeBytes } = link
    const piece = file.slice(offsetBytes, offsetBytes + sizeBytes)
    return putPiece(link.uploadUrl, piece, halt.signal, (loaded) =>
      report(partNumber, loaded)
    )
  }

  async function sendPiece(partNumber: number): Promise<number | undefined> {
    let status = 0
    for (
      let attempt = 0;
      attempt < PUT_ATTEMPTS && !halt.signal.aborted;
      attempt++
    ) {
      const link = await linkFor(partNumber, attempt > 0)
      status = link ? await putLink(partNumber, link) : 200
      if (status >= 200 && status < 300) {
        report(partNumber, links.get(partNumber)?.sizeBytes ?? 0)
        return undefined
      }
      report(partNumber, 0)
    }
    return status
  }

  async function worker() {
    for (
      let next = queue.shift();
      next !== undefined && !halt.signal.aborted;
      next = queue.shift()
    ) {
      const status = await sendPiece(next)
      if (status === undefined) continue
      stopped ??= `storage ${status}`
      halt.abort()
    }
  }

  try {
    await Promise.all(Array.from({ length: PARALLEL_PUTS }, worker))
  } finally {
    signal.removeEventListener('abort', forwardAbort)
    halt.abort()
  }
  return stopped
}

function removeModel(
  { workspaceId, deploymentId }: DeploymentModelTarget,
  modelId: string
): Promise<boolean> {
  return workspaceApi
    .removeDeploymentModel(workspaceId, deploymentId, modelId)
    .then(
      () => true,
      () => false
    )
}

function isRefusal(cause: unknown): cause is WorkspaceApiError {
  return cause instanceof WorkspaceApiError && cause.status === 409
}

function stoppedBy(cause: unknown, signal: AbortSignal): UploadStopped {
  if (signal.aborted) return { ok: false, reason: 'cancelled' }
  if (isRefusal(cause)) {
    return { ok: false, reason: 'refused', message: cause.message }
  }
  return { ok: false, reason: 'failed', cause }
}

async function joinPieces(
  { workspaceId, deploymentId }: DeploymentModelTarget,
  blobId: string,
  signal: AbortSignal
): Promise<UploadStopped | undefined> {
  for (let attempt = 0; attempt < JOIN_ATTEMPTS && !signal.aborted; attempt++) {
    try {
      await workspaceApi.completeDeploymentModelUpload(
        workspaceId,
        deploymentId,
        blobId,
        signal
      )
      return undefined
    } catch (cause) {
      if (isRefusal(cause)) return stoppedBy(cause, signal)
    }
  }
  return signal.aborted ? { ok: false, reason: 'cancelled' } : undefined
}

async function sendPieces(
  file: File,
  target: DeploymentModelTarget,
  upload: { blobId: string; parts: readonly DeploymentModelUploadPart[] },
  options: DeploymentModelUploadOptions
): Promise<UploadStopped | undefined> {
  const { workspaceId, deploymentId } = target
  const { signal } = options
  options.onSending()
  try {
    const stopped = await putPieces(
      file,
      upload.parts,
      () =>
        workspaceApi.refreshDeploymentModelUploadParts(
          workspaceId,
          deploymentId,
          upload.blobId,
          signal
        ),
      options
    )
    if (signal.aborted) return { ok: false, reason: 'cancelled' }
    if (stopped) return { ok: false, reason: 'failed', cause: stopped }
  } catch (cause) {
    return stoppedBy(cause, signal)
  }
  return joinPieces(target, upload.blobId, signal)
}

async function removeAfter(
  target: DeploymentModelTarget,
  modelId: string,
  stopped: UploadStopped
): Promise<DeploymentModelUploadResult> {
  const removed = await removeModel(target, modelId)
  return removed
    ? { ...stopped, modelId }
    : { ...stopped, modelId, stillListed: true }
}

type CreatedUpload =
  | { ok: true; blobId: string; parts?: readonly DeploymentModelUploadPart[] }
  | UploadStopped

async function createUpload(
  file: File,
  { workspaceId, deploymentId }: DeploymentModelTarget,
  { signal, freshUpload }: DeploymentModelUploadOptions
): Promise<CreatedUpload> {
  const sha256 = await fileSha256(file, signal)
  if (sha256 === undefined) return { ok: false, reason: 'cancelled' }
  const { blobId, deduplicated, parts } =
    await workspaceApi.createDeploymentModelUpload(
      workspaceId,
      deploymentId,
      {
        filename: file.name,
        sizeBytes: file.size,
        sha256,
        parts: true,
        reuse: !freshUpload
      },
      signal
    )
  if (deduplicated) return { ok: true, blobId }
  if (!parts?.length) {
    return { ok: false, reason: 'failed', cause: 'upload has no pieces' }
  }
  return { ok: true, blobId, parts }
}

async function fillUpload(
  file: File,
  target: DeploymentModelTarget,
  { blobId, parts }: Extract<CreatedUpload, { ok: true }>,
  options: DeploymentModelUploadOptions
): Promise<UploadStopped | undefined> {
  if (options.signal.aborted) return { ok: false, reason: 'cancelled' }
  if (!parts) return undefined
  return sendPieces(file, target, { blobId, parts }, options)
}

async function listedBefore(
  { workspaceId, deploymentId }: DeploymentModelTarget,
  created: Extract<CreatedUpload, { ok: true }>,
  signal: AbortSignal
): Promise<Set<string>> {
  if (created.parts) return new Set()
  const models = await workspaceApi.listDeploymentModels(
    workspaceId,
    deploymentId,
    signal
  )
  return new Set(models.map((model) => model.id))
}

async function addToDeployment(
  file: File,
  target: DeploymentModelTarget,
  options: DeploymentModelUploadOptions
): Promise<DeploymentModelUploadResult> {
  const created = await createUpload(file, target, options)
  if (!created.ok) return created
  const listed = await listedBefore(target, created, options.signal)
  const added = await workspaceApi.addDeploymentModel(
    target.workspaceId,
    target.deploymentId,
    { blobId: created.blobId, type: options.type }
  )
  if (added === 'notOn') return { ok: false, reason: 'notOn' }
  const stopped = await fillUpload(file, target, created, options)
  if (!stopped) return { ok: true, modelId: added.id }
  if (listed.has(added.id)) return stopped
  return removeAfter(target, added.id, stopped)
}

async function uploadModelToDeployment(
  file: File,
  target: DeploymentModelTarget,
  options: DeploymentModelUploadOptions
): Promise<DeploymentModelUploadResult> {
  try {
    return await addToDeployment(file, target, options)
  } catch (cause) {
    return stoppedBy(cause, options.signal)
  }
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}

async function readOnce<T>(
  { workspaceId, deploymentId }: DeploymentModelTarget,
  modelId: string,
  signal: AbortSignal,
  answer: (entry: DeploymentModelEntry | undefined) => T | undefined
): Promise<T | undefined> {
  const models = await workspaceApi
    .listDeploymentModels(workspaceId, deploymentId, signal)
    .catch(() => undefined)
  if (signal.aborted || !models) return undefined
  return answer(models.find((model) => model.id === modelId))
}

async function readModel<T>(
  target: DeploymentModelTarget,
  modelId: string,
  signal: AbortSignal,
  answer: (entry: DeploymentModelEntry | undefined) => T | undefined
): Promise<T | undefined> {
  while (!signal.aborted) {
    const settled = await readOnce(target, modelId, signal, answer)
    if (settled !== undefined) return settled
    await pause(LIST_POLL_MS, signal)
  }
  return undefined
}

function readiness(
  entry: DeploymentModelEntry | undefined
): DeploymentModelOutcome | undefined {
  if (!entry || entry.status === 'removing') return 'gone'
  if (entry.status === 'ready') return 'ready'
  if (entry.status === 'failed') return 'failed'
  return undefined
}

function waitForDeploymentModel(
  target: DeploymentModelTarget,
  modelId: string,
  signal: AbortSignal
): Promise<DeploymentModelOutcome | undefined> {
  return readModel(target, modelId, signal, readiness)
}

async function clearDeploymentModel(
  target: DeploymentModelTarget,
  modelId: string,
  signal: AbortSignal
): Promise<boolean> {
  const removed = await removeModel(target, modelId)
  const cleared = await readModel(target, modelId, signal, (entry) => {
    if (!entry) return true
    return removed ? undefined : false
  })
  return cleared === true
}

export const deploymentModelUploadApi = {
  uploadModelToDeployment,
  waitForDeploymentModel,
  clearDeploymentModel
}
