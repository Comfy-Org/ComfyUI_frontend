import { reportError } from '@comfyorg/telemetry/reportError'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

export const ASK_BEFORE_CLOUD_CHECK = 'Comfy.Cloud.AskBeforeCompatibilityCheck'

let pendingSave: Promise<void> = Promise.resolve()

async function storeAskBeforeCloudCheck(askBeforeCheck: boolean) {
  if (useSettingStore().get(ASK_BEFORE_CLOUD_CHECK) !== askBeforeCheck) return
  try {
    const response = await api.storeSetting(
      ASK_BEFORE_CLOUD_CHECK,
      askBeforeCheck
    )
    if (response.ok) return
    reportSaveFailure(
      new Error(
        `Failed to store ${ASK_BEFORE_CLOUD_CHECK}: ${response.status} ${response.statusText || 'Request failed'}`
      ),
      askBeforeCheck
    )
  } catch (cause) {
    reportSaveFailure(cause, askBeforeCheck)
  }
}

function reportSaveFailure(cause: unknown, askBeforeCheck: boolean) {
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
  const appliedLocally = useSettingStore().applySettingLocally(
    ASK_BEFORE_CLOUD_CHECK,
    askBeforeCheck
  )
  const save = pendingSave
    .then(() => appliedLocally)
    .then(() => storeAskBeforeCloudCheck(askBeforeCheck))
  pendingSave = save.catch(() => undefined)
  return save
}
