import type { SettingWriteOutcome } from '@comfyorg/settings-core/settingStore'
import { reportError } from '@comfyorg/telemetry/reportError'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'

export const ASK_BEFORE_CLOUD_CHECK = 'Comfy.Cloud.AskBeforeCompatibilityCheck'

let pendingSave: Promise<void> = Promise.resolve()

function failureCause(outcome: SettingWriteOutcome): unknown {
  switch (outcome.status) {
    case 'saved':
    case 'unchanged':
      return undefined
    case 'unconfirmed':
      return outcome.cause
    default:
      return new Error(
        `Failed to store ${ASK_BEFORE_CLOUD_CHECK}: ${outcome.statusCode} ${outcome.statusText || 'Request failed'}`
      )
  }
}

async function writeAskBeforeCloudCheck(askBeforeCheck: boolean) {
  const outcome = await useSettingStore()
    .setWithOutcome(ASK_BEFORE_CLOUD_CHECK, askBeforeCheck)
    .catch((cause: unknown): SettingWriteOutcome => ({
      status: 'unconfirmed',
      cause
    }))
  const cause = failureCause(outcome)
  if (cause === undefined) return
  reportError(cause, {
    surface: 'platform',
    errorType: 'error_saving_cloud_check_consent',
    level: 'warning'
  })
  useToast().error(t('openOnCloud.runDialog.consentNotSaved'), {
    description: askBeforeCheck
      ? t('openOnCloud.runDialog.askAgainNotSaved')
      : t('openOnCloud.runDialog.dontAskAgainNotSaved')
  })
}

export function saveAskBeforeCloudCheck(askBeforeCheck: boolean) {
  pendingSave = pendingSave.then(() => writeAskBeforeCloudCheck(askBeforeCheck))
  return pendingSave
}
