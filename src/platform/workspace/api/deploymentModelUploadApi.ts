import { sum } from 'es-toolkit'

import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import { fileSha256 } from '@/platform/workspace/api/fileSha256'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { DeploymentModelUploadPart } from '@/platform/workspace/api/workspaceApi'
import type { WorkspaceId } from '@/platform/workspace/workspaceTypes'

const PARALLEL_PUTS = 8
const PUT_ATTEMPTS = 3
const LINK_RENEW_MARGIN_MS = 60_000
const LIST_POLL_MS = 3_000

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
    }

export type DeploymentModelOutcome = 'ready' | 'failed' | 'gone'

interface DeploymentModelUploadOptions {
  type: string
  signal: AbortSignal
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

function removeQuietly(
  { workspaceId, deploymentId }: DeploymentModelTarget,
  modelId: string
) {
  void workspaceApi
    .removeDeploymentModel(workspaceId, deploymentId, modelId)
    .catch(() => undefined)
}

async function sendAddedFile(
  file: File,
  target: DeploymentModelTarget,
  blobId: string,
  parts: readonly DeploymentModelUploadPart[],
  options: DeploymentModelUploadOptions
): Promise<string | undefined> {
  const { workspaceId, deploymentId } = target
  const { signal } = options
  options.onSending()
  const stopped = await putPieces(
    file,
    parts,
    () =>
      workspaceApi.refreshDeploymentModelUploadParts(
        workspaceId,
        deploymentId,
        blobId,
        signal
      ),
    options
  )
  if (stopped || signal.aborted) return stopped
  await workspaceApi.completeDeploymentModelUpload(
    workspaceId,
    deploymentId,
    blobId,
    signal
  )
  return undefined
}

async function addToDeployment(
  file: File,
  target: DeploymentModelTarget,
  options: DeploymentModelUploadOptions
): Promise<DeploymentModelUploadResult> {
  const { workspaceId, deploymentId } = target
  const { signal } = options
  const sha256 = await fileSha256(file, signal)
  if (sha256 === undefined) return { ok: false, reason: 'cancelled' }
  const { blobId, parts } = await workspaceApi.createDeploymentModelUpload(
    workspaceId,
    deploymentId,
    { filename: file.name, sizeBytes: file.size, sha256, parts: true },
    signal
  )
  if (!parts?.length) {
    return { ok: false, reason: 'failed', cause: 'upload has no pieces' }
  }
  const added = await workspaceApi.addDeploymentModel(
    workspaceId,
    deploymentId,
    { blobId, type: options.type },
    signal
  )
  if (added === 'notOn') return { ok: false, reason: 'notOn' }
  try {
    const stopped = await sendAddedFile(file, target, blobId, parts, options)
    if (signal.aborted) {
      removeQuietly(target, added.id)
      return { ok: false, reason: 'cancelled' }
    }
    if (stopped) {
      removeQuietly(target, added.id)
      return { ok: false, reason: 'failed', cause: stopped }
    }
  } catch (cause) {
    removeQuietly(target, added.id)
    throw cause
  }
  return { ok: true, modelId: added.id }
}

async function uploadModelToDeployment(
  file: File,
  target: DeploymentModelTarget,
  options: DeploymentModelUploadOptions
): Promise<DeploymentModelUploadResult> {
  try {
    return await addToDeployment(file, target, options)
  } catch (cause) {
    if (options.signal.aborted) return { ok: false, reason: 'cancelled' }
    if (cause instanceof WorkspaceApiError && cause.status === 409) {
      return { ok: false, reason: 'refused', message: cause.message }
    }
    return { ok: false, reason: 'failed', cause }
  }
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}

async function waitForDeploymentModel(
  { workspaceId, deploymentId }: DeploymentModelTarget,
  modelId: string,
  signal: AbortSignal
): Promise<DeploymentModelOutcome | undefined> {
  const stopped = () => signal.aborted
  while (!stopped()) {
    const models = await workspaceApi
      .listDeploymentModels(workspaceId, deploymentId, signal)
      .catch(() => undefined)
    if (stopped()) break
    if (models) {
      const entry = models.find((model) => model.id === modelId)
      if (!entry || entry.status === 'removing') return 'gone'
      if (entry.status === 'ready') return 'ready'
      if (entry.status === 'failed') return 'failed'
    }
    await pause(LIST_POLL_MS, signal)
  }
  return undefined
}

export const deploymentModelUploadApi = {
  uploadModelToDeployment,
  waitForDeploymentModel
}
