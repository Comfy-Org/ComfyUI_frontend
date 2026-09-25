import { z } from 'astro/zod'

import type { components, operations } from '@comfyorg/registry-types'

import { combineAbortSignals, createTimeoutSignal } from '../utils/abortSignal'
import { WORKSHOP_ROUTER_BASE_URL } from './workshop-env'
import { MAX_URL_UPLOAD_BYTES } from './workshop-limits'
import {
  WorkshopRouterError,
  workshopResponseDetails
} from './workshop-router-errors'
import type { WorkshopFailureStage } from './workshop-router-errors'

type StorageUrls = Required<
  Pick<
    components['schemas']['CustomerStorageResourceResponse'],
    'upload_url' | 'download_url'
  >
> &
  Pick<components['schemas']['CustomerStorageResourceResponse'], 'expires_at'>
const storageUrl = z.url().refine((value) => {
  const url = new URL(value)
  return url.protocol === 'https:' && !url.username && !url.password
})
const storageUrls: z.ZodType<StorageUrls> = z.object({
  upload_url: storageUrl,
  download_url: storageUrl,
  expires_at: z.string().optional()
})

// The pinned comfy_api_svc.go storage handler signs GET URLs for 24 hours;
// its two-field response does not yet include expires_at. Start conservatively
// before requesting the grant, then leave a margin for clock/network skew.
const LEGACY_DOWNLOAD_TTL_MS = 24 * 60 * 60 * 1000
const EXPIRY_MARGIN_MS = 60_000

async function uploadStep<T>(
  stage: WorkshopFailureStage,
  callerSignal: AbortSignal,
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action()
  } catch (error) {
    callerSignal.throwIfAborted()
    if (error instanceof WorkshopRouterError) throw error
    throw new WorkshopRouterError('upload', null, {}, undefined, stage)
  }
}

export function createWorkshopUrlUploader() {
  const completed = new WeakMap<
    File,
    { scope: string; url: string; expiresAt: number }
  >()

  return async function upload(
    file: File,
    token: string,
    scope: string,
    callerSignal: AbortSignal
  ): Promise<string> {
    callerSignal.throwIfAborted()
    if (!token || !scope || file.size > MAX_URL_UPLOAD_BYTES)
      throw new Error('Invalid upload')
    const previous = completed.get(file)
    if (previous?.scope === scope && previous.expiresAt > Date.now())
      return previous.url
    const signal = combineAbortSignals([
      callerSignal,
      createTimeoutSignal(120_000)
    ])
    const contentType = file.type || 'application/octet-stream'
    const basename = (file.name.split(/[\\/]/).at(-1) || 'input')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(-120)
    const body = {
      file_name: `${crypto.randomUUID()}-${basename}`,
      content_type: contentType
    } satisfies operations['createCustomerStorageResource']['requestBody']['content']['application/json']
    const grantRequestedAt = Date.now()
    const { urls, expiresAt } = await uploadStep(
      'upload_grant',
      callerSignal,
      async () => {
        const response = await fetch(
          `${WORKSHOP_ROUTER_BASE_URL}/customers/storage`,
          {
            method: 'POST',
            credentials: 'omit',
            redirect: 'error',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            signal
          }
        )
        if (!response.ok)
          throw new WorkshopRouterError(
            'upload',
            response.headers.get('X-Comfy-Request-Id'),
            {},
            workshopResponseDetails(response),
            'upload_grant'
          )
        const urls = storageUrls.parse(await response.json())
        const expiresAt =
          urls.expires_at === undefined
            ? grantRequestedAt + LEGACY_DOWNLOAD_TTL_MS
            : Date.parse(urls.expires_at)
        if (!Number.isFinite(expiresAt))
          throw new Error('Invalid upload expiry')
        if (expiresAt <= Date.now()) throw new Error('Upload grant expired')
        return { urls, expiresAt }
      }
    )
    signal.throwIfAborted()
    await uploadStep('upload_put', callerSignal, async () => {
      const uploaded = await fetch(urls.upload_url, {
        method: 'PUT',
        credentials: 'omit',
        redirect: 'error',
        headers: { 'Content-Type': contentType },
        body: file,
        signal
      })
      if (!uploaded.ok)
        throw new WorkshopRouterError(
          'upload',
          null,
          {},
          workshopResponseDetails(uploaded),
          'upload_put'
        )
      signal.throwIfAborted()
    })
    completed.set(file, {
      scope,
      url: urls.download_url,
      expiresAt: expiresAt - EXPIRY_MARGIN_MS
    })
    return urls.download_url
  }
}
