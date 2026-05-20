import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { launchChurnkeyCancellation } from '@/platform/cloud/churnkey/launchChurnkeyCancellation'
import {
  ChurnkeyAuthUnavailableError,
  useChurnkey
} from '@/platform/cloud/churnkey/useChurnkey'

import { showCancelSubscriptionDialog } from './showCancelSubscriptionDialog'

function shouldUseChurnkey(): boolean {
  const { flags } = useFeatureFlags()
  if (!flags.churnkeyCancellationEnabled) return false
  if (!useChurnkey().isConfigured) {
    console.warn(
      '[Churnkey] Cancellation flag is enabled but CHURNKEY_APP_ID is not set; falling back to legacy dialog.'
    )
    return false
  }
  return true
}

export async function launchCancellationFlow(cancelAt?: string): Promise<void> {
  if (!shouldUseChurnkey()) {
    await showCancelSubscriptionDialog(cancelAt)
    return
  }

  try {
    await launchChurnkeyCancellation()
  } catch (err) {
    if (err instanceof ChurnkeyAuthUnavailableError) {
      await showCancelSubscriptionDialog(cancelAt)
      return
    }
    throw err
  }
}
