import { z } from 'zod'
import {
  zInputUploadResponse,
  zUploadGrantResponse
} from '@comfyorg/ingest-types/zod'

import { combineAbortSignals, createTimeoutSignal } from '../utils/abortSignal'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'
import { outputExtension } from './workshop-output-media'
import type { WorkflowApi } from './workshop-workflow-api'
import {
  WorkshopWorkflowError,
  workflowResponseJson
} from './workshop-workflow-api'
import {
  WORKFLOW_FILE_BYTES,
  workflowHttpsUrl
} from './workshop-workflow-response'

export type WorkflowMediaUploader = (
  source: File | string,
  signal: AbortSignal
) => Promise<string>

const uploadGrantSchema = zUploadGrantResponse.extend({
  upload_path: zUploadGrantResponse.shape.upload_path.regex(
    /^\/api\/uploads\/[a-zA-Z0-9_-]+$/
  ),
  expires_in: zUploadGrantResponse.shape.expires_in.positive()
})
const uploadResultSchema = zInputUploadResponse.extend({
  name: zInputUploadResponse.shape.name
    .regex(/^[a-zA-Z0-9_-][a-zA-Z0-9._-]{0,255}$/)
    .refine((value) => !value.includes('..')),
  subfolder: z.literal(''),
  type: z.literal('input')
})

async function downloadInput(
  source: string,
  signal: AbortSignal,
  transport: typeof fetch
): Promise<File> {
  if (!workflowHttpsUrl.safeParse(source).success)
    throw new WorkshopWorkflowError('invalid_input')
  const response = await transport(source, {
    signal,
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    referrerPolicy: 'no-referrer'
  })
  const type = (response.headers.get('Content-Type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (
    !response.ok ||
    !/^(image|audio|video)\//.test(type) ||
    Number(response.headers.get('Content-Length')) > WORKFLOW_FILE_BYTES ||
    !response.body
  ) {
    await response.body?.cancel()
    throw new WorkshopWorkflowError('media_unavailable')
  }
  return inputFile(response.body, type, signal)
}

async function inputFile(
  body: ReadableStream<Uint8Array>,
  type: string,
  signal: AbortSignal
): Promise<File> {
  const reader = body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let size = 0
  try {
    for (;;) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > WORKFLOW_FILE_BYTES)
        throw new WorkshopWorkflowError('payload_too_large')
      chunks.push(new Uint8Array(value))
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
  return new File(chunks, 'workflow-input.' + outputExtension(type), { type })
}

export function createWorkflowUploader(
  api: WorkflowApi,
  transport = globalThis.fetch
): WorkflowMediaUploader {
  return async (source, signal) => {
    signal.throwIfAborted()
    const requestSignal = combineAbortSignals([
      signal,
      createTimeoutSignal(120_000)
    ])
    try {
      const file =
        typeof source === 'string'
          ? await downloadInput(source, requestSignal, transport)
          : source
      if (
        !file.size ||
        file.size > WORKFLOW_FILE_BYTES ||
        !/^(image|video|audio)\//.test(file.type)
      )
        throw new WorkshopWorkflowError('invalid_input')
      const grant = await api.request(
        '/api/inputs/upload-url',
        uploadGrantSchema,
        requestSignal,
        'POST',
        { content_type: file.type }
      )
      const response = await transport(
        new URL(grant.upload_path, WORKSHOP_CLOUD_BASE_URL),
        {
          method: 'PUT',
          body: file,
          signal: requestSignal,
          credentials: 'omit',
          redirect: 'error',
          headers: { 'Content-Type': file.type }
        }
      )
      if (!response.ok) {
        await response.body?.cancel()
        throw new WorkshopWorkflowError(
          'media_unavailable',
          {},
          response.status
        )
      }
      const result = uploadResultSchema.safeParse(
        await workflowResponseJson(response)
      )
      if (!result.success) throw new WorkshopWorkflowError('response')
      signal.throwIfAborted()
      return result.data.name
    } catch (error) {
      signal.throwIfAborted()
      if (error instanceof WorkshopWorkflowError) throw error
      throw new WorkshopWorkflowError('media_unavailable')
    }
  }
}
