import type { operations } from '@comfyorg/registry-types'
import type { z } from 'astro/zod'

import type { WorkflowApi } from './workshop-workflow-api'
import { WorkshopWorkflowError } from './workshop-workflow-api'
import {
  WORKFLOW_FILE_BYTES,
  workflowAccessSchema,
  workflowUploadSchema
} from './workshop-workflow-response'

type WorkflowUploadGrant = z.infer<typeof workflowUploadSchema>

function validateWorkflowFile(file: File): void {
  if (
    file.size < 1 ||
    file.size > WORKFLOW_FILE_BYTES ||
    !/^(image|video|audio)\//.test(file.type)
  )
    throw new WorkshopWorkflowError('invalid_input')
}

function workflowUploadHeaders(
  file: File,
  grant: WorkflowUploadGrant
): Headers {
  const upload = grant.workflow_upload
  const accessPath = `/customers/storage/${upload.id}/access`
  const headers = new Headers(upload.uploadHeaders)
  if (
    upload.accessUrl !== accessPath ||
    Date.parse(upload.uploadExpiresAt) <= Date.now() ||
    Date.parse(upload.assetExpiresAt) <= Date.now() ||
    headers.get('content-type') !== file.type ||
    headers.get('x-goog-if-generation-match') !== '0' ||
    headers.get('x-goog-content-length-range') !==
      `${file.size},${file.size}` ||
    [...headers.keys()].some(
      (key) =>
        ![
          'content-type',
          'cache-control',
          'x-goog-if-generation-match',
          'x-goog-content-length-range'
        ].includes(key.toLowerCase())
    )
  )
    throw new WorkshopWorkflowError('response')
  return headers
}

export function createWorkflowUploader(
  api: WorkflowApi,
  transport = globalThis.fetch
) {
  const completed = new WeakMap<File, { url: string; expiresAt: number }>()
  const granted = new WeakMap<File, WorkflowUploadGrant>()

  async function finalize(
    file: File,
    grant: WorkflowUploadGrant,
    signal: AbortSignal
  ) {
    const upload = grant.workflow_upload
    const finalized = await api.request(
      upload.accessUrl,
      workflowAccessSchema,
      signal
    )
    if (
      finalized.refreshUrl !== upload.accessUrl ||
      finalized.sizeBytes !== file.size ||
      finalized.mimeType !== file.type ||
      Date.parse(finalized.expiresAt) <= Date.now()
    )
      throw new WorkshopWorkflowError('response')
    signal.throwIfAborted()
    completed.set(file, {
      url: upload.inputUrl,
      expiresAt: Date.parse(upload.assetExpiresAt)
    })
    granted.delete(file)
    return upload.inputUrl
  }

  async function recover(
    file: File,
    grant: WorkflowUploadGrant,
    signal: AbortSignal
  ): Promise<string | undefined> {
    try {
      return await finalize(file, grant, signal)
    } catch (error) {
      signal.throwIfAborted()
      if (
        !(error instanceof WorkshopWorkflowError) ||
        error.code !== 'upload_pending'
      )
        throw error
      return undefined
    }
  }

  async function pendingGrant(
    file: File,
    previous: WorkflowUploadGrant | undefined,
    signal: AbortSignal
  ): Promise<WorkflowUploadGrant> {
    if (
      previous &&
      Date.parse(previous.workflow_upload.uploadExpiresAt) > Date.now()
    )
      return previous
    const body = {
      purpose: 'workshop_workflow',
      file_name: 'workflow-input',
      content_type: file.type,
      size_bytes: file.size
    } satisfies operations['createCustomerStorageResource']['requestBody']['content']['application/json']
    return api.request(
      '/customers/storage',
      workflowUploadSchema,
      signal,
      'POST',
      body
    )
  }

  async function put(
    file: File,
    grant: WorkflowUploadGrant,
    headers: Headers,
    signal: AbortSignal
  ): Promise<void> {
    const controller = new AbortController()
    const abort = () => controller.abort(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => controller.abort(), 120_000)
    try {
      signal.throwIfAborted()
      const result = await transport(grant.upload_url, {
        method: 'PUT',
        body: file,
        headers,
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error'
      })
      await result.body?.cancel()
      if (!result.ok)
        throw new WorkshopWorkflowError('delivery_failed', {}, result.status)
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
    }
  }

  return async (file: File, signal: AbortSignal): Promise<string> => {
    signal.throwIfAborted()
    validateWorkflowFile(file)
    const previous = completed.get(file)
    if (previous && previous.expiresAt > Date.now() + 60_000)
      return previous.url
    const existing = granted.get(file)
    if (existing) {
      const recovered = await recover(file, existing, signal)
      if (recovered) return recovered
    }
    const grant = await pendingGrant(file, existing, signal)
    const headers = workflowUploadHeaders(file, grant)
    granted.set(file, grant)
    try {
      await put(file, grant, headers, signal)
      return await finalize(file, grant, signal)
    } catch (error) {
      signal.throwIfAborted()
      if (error instanceof WorkshopWorkflowError) throw error
      throw new WorkshopWorkflowError('delivery_failed')
    }
  }
}
