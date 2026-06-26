import { isChurnkeyConfigured } from '@/platform/cloud/churnkey/churnkeyClient'
import {
  ChurnkeyAuthUnavailableError,
  ChurnkeyEmbedLoadError
} from '@/platform/cloud/churnkey/errors'
import { launchChurnkeyCancellation } from '@/platform/cloud/churnkey/launchChurnkeyCancellation'

import { showCancelSubscriptionDialog } from './showCancelSubscriptionDialog'

function shouldUseChurnkey(): boolean {
  if (isChurnkeyConfigured()) return true
  console.info(
    '[Churnkey] Using legacy cancel dialog: churnkey_app_id flag is not set.'
  )
  return false
}

export async function launchCancellationFlow(cancelAt?: string): Promise<void> {
  if (!shouldUseChurnkey()) {
    await showCancelSubscriptionDialog(cancelAt)
    return
  }

  try {
    await launchChurnkeyCancellation()
  } catch (err) {
    const fallbackReason =
      err instanceof ChurnkeyAuthUnavailableError
        ? 'auth endpoint unavailable'
        : err instanceof ChurnkeyEmbedLoadError
          ? 'embed script failed to load (often blocked by an ad blocker)'
          : null
    if (fallbackReason === null) throw err
    console.warn(
      `[Churnkey] Falling back to legacy cancel dialog: ${fallbackReason}.`
    )
    await showCancelSubscriptionDialog(cancelAt)
  }
}
