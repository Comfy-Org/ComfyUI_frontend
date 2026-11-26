import { reportError } from '@comfyorg/telemetry/reportError'

import { safeLocalStorage } from '@/base/storage/safeStorage'
import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

export const ASK_BEFORE_CLOUD_CHECK = 'Comfy.Cloud.AskBeforeCompatibilityCheck'
export const CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS = 10_000

export const PENDING_ASK_AGAIN_KEY =
  'Comfy.Cloud.AskBeforeCompatibilityCheck.PendingRestore'

let pendingSave: Promise<void> = Promise.resolve()
let unsettledLateWrites = 0

function hasPendingAskAgain() {
  return safeLocalStorage.getItem(PENDING_ASK_AGAIN_KEY) === 'true'
}

function setPendingAskAgain(pending: boolean) {
  if (pending) safeLocalStorage.setItem(PENDING_ASK_AGAIN_KEY, 'true')
  else safeLocalStorage.removeItem(PENDING_ASK_AGAIN_KEY)
}

export function skipsCloudCheckQuestion() {
  if (hasPendingAskAgain()) {
    void saveAskBeforeCloudCheck(true)
    return false
  }
  return !useSettingStore().get(ASK_BEFORE_CLOUD_CHECK)
}

function isCurrentChoice(askBeforeCheck: boolean) {
  return useSettingStore().get(ASK_BEFORE_CLOUD_CHECK) === askBeforeCheck
}

const TIMED_OUT = Symbol('timed out')

function resendLatestChoice() {
  void saveAskBeforeCloudCheck(useSettingStore().get(ASK_BEFORE_CLOUD_CHECK))
}

async function storeAskBeforeCloudCheck(askBeforeCheck: boolean) {
  const request = api.storeSetting(ASK_BEFORE_CLOUD_CHECK, askBeforeCheck)
  let timer: ReturnType<typeof setTimeout> | undefined
  const result = await Promise.race([
    request,
    new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimeout(
        () => resolve(TIMED_OUT),
        CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS
      )
    })
  ]).finally(() => clearTimeout(timer))
  if (result === TIMED_OUT) {
    unsettledLateWrites += 1
    const settleLateWrite = () => {
      unsettledLateWrites -= 1
      resendLatestChoice()
    }
    request.then(settleLateWrite, settleLateWrite)
    return new Error(
      `Timed out storing ${ASK_BEFORE_CLOUD_CHECK} after ${CLOUD_CHECK_CONSENT_SAVE_TIMEOUT_MS} ms`
    )
  }
  if (result.ok) return undefined
  return new Error(
    `Failed to store ${ASK_BEFORE_CLOUD_CHECK}: ${result.status} ${result.statusText || 'Request failed'}`
  )
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
    if (failure) {
      reportSaveFailure(failure, askBeforeCheck)
      return
    }
    if (askBeforeCheck && unsettledLateWrites === 0 && isCurrentChoice(true))
      setPendingAskAgain(false)
  } catch (cause) {
    reportSaveFailure(cause, askBeforeCheck)
  }
}

export function saveAskBeforeCloudCheck(askBeforeCheck: boolean) {
  setPendingAskAgain(askBeforeCheck)
  const appliedLocally = useSettingStore().applySettingLocally(
    ASK_BEFORE_CLOUD_CHECK,
    askBeforeCheck
  )
  pendingSave = pendingSave.then(() =>
    persistAskBeforeCloudCheck(askBeforeCheck, appliedLocally)
  )
  return pendingSave
}
