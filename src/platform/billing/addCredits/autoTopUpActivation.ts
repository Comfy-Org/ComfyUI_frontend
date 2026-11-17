import { delay } from 'es-toolkit'

import type { AutoTopUpActivationOutcome } from '@comfyorg/account-core/billing'
import type { HostedTopupCheckout } from '@comfyorg/ingest-types'

const READ_ATTEMPTS = 20
const READ_INTERVAL_MS = 1500

function autoTopUpActivationOutcome(
  checkout: HostedTopupCheckout
): AutoTopUpActivationOutcome | undefined {
  const settings = checkout.auto_top_up
  if (checkout.auto_top_up_activation === 'failed') return { status: 'failed' }
  if (checkout.auto_top_up_activation !== 'on' || !settings) return undefined
  return {
    status: 'on',
    settings: {
      threshold_credits: settings.threshold_credits,
      target_credits: settings.target_credits,
      monthly_budget_cents: settings.monthly_budget_is_default
        ? null
        : settings.monthly_budget_cents
    }
  }
}

/** Reads the checkout until activation leaves pending; undefined if it never does. Rejects on abort. */
export async function readAutoTopUpActivation(
  read: (signal: AbortSignal) => Promise<HostedTopupCheckout>,
  signal: AbortSignal
): Promise<AutoTopUpActivationOutcome | undefined> {
  for (let attempt = 0; attempt < READ_ATTEMPTS; attempt++) {
    signal.throwIfAborted()
    const checkout = await read(signal).catch(() => null)
    signal.throwIfAborted()
    if (checkout && checkout.auto_top_up_activation !== 'pending') {
      return autoTopUpActivationOutcome(checkout)
    }
    await delay(READ_INTERVAL_MS, { signal })
  }
  return undefined
}
