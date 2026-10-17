import { z } from 'zod'

import { api } from '@/scripts/api'
import type { AuthHeader } from '@/types/authTypes'

const BUNDLE_TIMEOUT_MS = 90_000

const zBundleCreated = z.object({ url: z.url({ protocol: /^https$/ }) })

const zBundleError = z.object({ error: z.string() })

export type BundleFailureReason =
  | 'unauthorized'
  | 'too_many_bundles'
  | 'too_large'
  | 'offline'
  | 'unavailable'
  | 'invalid_request'

type BundlePost =
  | { ok: true; response: Response }
  | { ok: false; cause: unknown }

export type BundleResult =
  | { ok: true; url: string }
  | { ok: false; reason: BundleFailureReason; cause?: unknown }

const REASON_BY_ERROR_CODE: Partial<Record<string, BundleFailureReason>> = {
  missing_credentials: 'unauthorized',
  unauthorized: 'unauthorized',
  too_many_bundles: 'too_many_bundles',
  too_large: 'too_large',
  offline: 'offline',
  builder_unavailable: 'unavailable',
  builder_rejected: 'unavailable',
  invalid_body: 'invalid_request',
  invalid_api_key_format: 'invalid_request',
  multiple_credentials: 'invalid_request'
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function failureReason(status: number, body: unknown): BundleFailureReason {
  const parsed = zBundleError.safeParse(body)
  const reason = parsed.success
    ? REASON_BY_ERROR_CODE[parsed.data.error]
    : undefined
  if (reason) return reason
  return status === 413 ? 'too_large' : 'unavailable'
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
