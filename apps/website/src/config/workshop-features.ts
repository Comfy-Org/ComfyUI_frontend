import type { SessionClient } from '@comfyorg/account-core/session'
/**
 * The one server flag the Workshop reads: `billing_sdk_topup_enabled` from
 * Cloud's /api/features, decided once per signed-in uid. Signed out, a failed
 * request, a missing key, and a non-boolean value are all false, so the
 * rollout can only add the SDK path and never take the site's own away.
 *
 * The cache keys on uid alone on purpose: a rollout flag is evaluated per
 * user, not per workspace, so switching workspace does not re-read it. A
 * failed read stays false for that uid until sign-out, which is the safe
 * direction — the flag can only add the SDK path — and keeps a wedged
 * /features from being re-hammered once per dialog.
 */
import { z } from 'zod'

import { workshopSessionClient } from './workshop-account'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

/** Ceiling on the flag read; a wedged /features must not hold the dialog. */
const FEATURES_TIMEOUT_MS = 5_000

const zBillingSdkTopupFeature = z.object({
  billing_sdk_topup_enabled: z.boolean().optional()
})

export function createBillingSdkTopupReader(
  session: Pick<SessionClient, 'getSnapshot'>,
  featuresUrl: string,
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args)
): () => Promise<boolean> {
  let cached:
    | { readonly uid: string; readonly enabled: Promise<boolean> }
    | undefined

  async function fetchFlag(token: string): Promise<boolean> {
    try {
      const response = await fetchImpl(featuresUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(FEATURES_TIMEOUT_MS)
      })
      if (!response.ok) return false
      const parsed = zBillingSdkTopupFeature.safeParse(await response.json())
      return parsed.success && parsed.data.billing_sdk_topup_enabled === true
    } catch {
      return false
    }
  }

  return async () => {
    const snapshot = session.getSnapshot()
    if (snapshot.phase !== 'authenticated') return false
    const { uid, token } = snapshot.session
    if (cached?.uid !== uid) cached = { uid, enabled: fetchFlag(token) }
    return cached.enabled
  }
}

export const readBillingSdkTopupEnabled = createBillingSdkTopupReader(
  workshopSessionClient,
  `${WORKSHOP_CLOUD_BASE_URL}/api/features`
)
