import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isChurnkeyConfigured } from '@/platform/cloud/churnkey/churnkeyClient'
import {
  ChurnkeyAuthUnavailableError,
  ChurnkeyEmbedLoadError
} from '@/platform/cloud/churnkey/errors'
import { launchChurnkeyCancellation } from '@/platform/cloud/churnkey/launchChurnkeyCancellation'

import { showCancelSubscriptionDialog } from './showCancelSubscriptionDialog'

function shouldUseChurnkey(): boolean {
  const { flags } = useFeatureFlags()
  if (!flags.churnkeyCancellationEnabled) return false
  return isChurnkeyConfigured()
}

export async function launchCancellationFlow(cancelAt?: string): Promise<void> {
  if (!shouldUseChurnkey()) {
    await showCancelSubscriptionDialog(cancelAt)
    return
  }

  try {
    await launchChurnkeyCancellation()
  } catch (err) {
    if (
      err instanceof ChurnkeyAuthUnavailableError ||
      err instanceof ChurnkeyEmbedLoadError
    ) {
      await showCancelSubscriptionDialog(cancelAt)
      return
    }
    throw err
  }
}
