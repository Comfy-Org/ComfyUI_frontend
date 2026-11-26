import { reportError } from '@comfyorg/telemetry/reportError'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

export const ASK_BEFORE_CLOUD_CHECK = 'Comfy.Cloud.AskBeforeCompatibilityCheck'
export const CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS = 10_000

let pendingSave: Promise<void> = Promise.resolve()

function isCurrentChoice(askBeforeCheck: boolean) {
  return useSettingStore().get(ASK_BEFORE_CLOUD_CHECK) === askBeforeCheck
}

async function storeAskBeforeCloudCheck(askBeforeCheck: boolean) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `Timed out storing ${ASK_BEFORE_CLOUD_CHECK} after ${CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS} ms`
          )
        ),
      CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS
    )
  })
  try {
    const response = await Promise.race([
      api.storeSetting(ASK_BEFORE_CLOUD_CHECK, askBeforeCheck),
      timedOut
    ])
    if (response.ok) return undefined
    return new Error(
      `Failed to store ${ASK_BEFORE_CLOUD_CHECK}: ${response.status} ${response.statusText || 'Request failed'}`
    )
  } finally {
    clearTimeout(timer)
  }
}

function reportSaveFailure(cause: unknown, askBeforeCheck: boolean) {
  reportError(cause, {
    surface: 'platform',
    errorType: 'error_saving_cloud_check_consent',
    level: 'warning'
  })
  if (!isCurrentChoice(askBeforeCheck)) return
  useToast().error(t('openOnCloud.runDialog.consentNotSaved'), {
    description: askBeforeCheck
      ? t('openOnCloud.runDialog.askAgainNotSaved')
      : t('openOnCloud.runDialog.dontAskAgainNotSaved')
  })
}

async function persistAskBeforeCloudCheck(
  askBeforeCheck: boolean,
  appliedLocally: Promise<unknown>
) {
  try {
    await appliedLocally
    if (!isCurrentChoice(askBeforeCheck)) return
    const failure = await storeAskBeforeCloudCheck(askBeforeCheck)
    if (failure) reportSaveFailure(failure, askBeforeCheck)
  } catch (cause) {
    reportSaveFailure(cause, askBeforeCheck)
  }
}

export function saveAskBeforeCloudCheck(askBeforeCheck: boolean) {
  const appliedLocally = useSettingStore().applySettingLocally(
    ASK_BEFORE_CLOUD_CHECK,
    askBeforeCheck
  )
  pendingSave = pendingSave.then(() =>
    persistAskBeforeCloudCheck(askBeforeCheck, appliedLocally)
  )
  return pendingSave
}
