import { z } from 'zod'

import { api } from '@/scripts/api'
import type { AuthHeader } from '@/types/authTypes'

const BUNDLE_TIMEOUT_MS = 90_000

const zBundleCreated = z.object({ url: z.url({ protocol: /^https$/ }) })

const zBundleErrorCode = z.enum([
  'missing_credentials',
  'unauthorized',
  'too_many_bundles',
  'too_large',
  'offline',
  'builder_busy',
  'builder_unavailable',
  'builder_rejected',
  'invalid_body',
  'invalid_api_key_format',
  'multiple_credentials'
])

type BundleErrorCode = z.infer<typeof zBundleErrorCode>

const zBundleError = z.object({ error: zBundleErrorCode })

export type BundleFailureReason =
  | 'unauthorized'
  | 'too_many_bundles'
  | 'too_large'
  | 'offline'
  | 'busy'
  | 'unavailable'
  | 'invalid_request'

type BundlePost =
  | { ok: true; response: Response }
  | { ok: false; cause: unknown }

export type BundleResult =
  | { ok: true; url: string }
  | { ok: false; reason: BundleFailureReason; cause?: unknown }

const REASON_BY_ERROR_CODE = {
  missing_credentials: 'unauthorized',
  unauthorized: 'unauthorized',
  invalid_api_key_format: 'unauthorized',
  too_many_bundles: 'too_many_bundles',
  too_large: 'too_large',
  offline: 'offline',
  builder_busy: 'busy',
  builder_unavailable: 'unavailable',
  builder_rejected: 'unavailable',
  invalid_body: 'invalid_request',
  multiple_credentials: 'invalid_request'
} satisfies Record<BundleErrorCode, BundleFailureReason>

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function failureReason(status: number, body: unknown): BundleFailureReason {
  const parsed = zBundleError.safeParse(body)
  if (parsed.success) return REASON_BY_ERROR_CODE[parsed.data.error]
  if (status === 413) return 'too_large'
  return status < 500 ? 'invalid_request' : 'unavailable'
}

async function postBundle(credential: AuthHeader): Promise<BundlePost> {
  try {
    const response = await api.fetchApi('/deploy/bundle', {
      method: 'POST',
      headers: { ...credential, 'Content-Type': 'application/json' },
      body: '{}',
      timeoutMs: BUNDLE_TIMEOUT_MS
    })
    return { ok: true, response }
  } catch (cause) {
    return { ok: false, cause }
  }
}

/** Has the local server upload its installation snapshot to the builder. */
export async function createInstallationBundle(
  credential: AuthHeader
): Promise<BundleResult> {
  const sent = await postBundle(credential)
  if (!sent.ok) return { ok: false, reason: 'unavailable', cause: sent.cause }

  const body = await readJson(sent.response)
  if (!sent.response.ok) {
    return {
      ok: false,
      reason: failureReason(sent.response.status, body),
      cause: body
    }
  }

  const created = zBundleCreated.safeParse(body)
  return created.success
    ? { ok: true, url: created.data.url }
    : { ok: false, reason: 'unavailable', cause: created.error }
}
