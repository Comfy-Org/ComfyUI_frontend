import { reportError } from '@comfyorg/telemetry/reportError'

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
let latestRevision = 0

function hasPendingAskAgain() {
  try {
    return localStorage.getItem(PENDING_ASK_AGAIN_KEY) === 'true'
  } catch {
    return false
  }
}

function setPendingAskAgain(pending: boolean) {
  try {
    if (pending) localStorage.setItem(PENDING_ASK_AGAIN_KEY, 'true')
    else localStorage.removeItem(PENDING_ASK_AGAIN_KEY)
  } catch {
    return
  }
}

export function skipsCloudCheckQuestion() {
  if (hasPendingAskAgain()) {
    void saveAskBeforeCloudCheck(true)
    return false
  }
  const savedAsk: unknown = useSettingStore().get(ASK_BEFORE_CLOUD_CHECK)
  return savedAsk === false
}

function isLatestChoice(askBeforeCheck: boolean, revision: number) {
  return revision === latestRevision && isCurrentChoice(askBeforeCheck)
}

function isCurrentChoice(askBeforeCheck: boolean) {
  return useSettingStore().get(ASK_BEFORE_CLOUD_CHECK) === askBeforeCheck
}

const TIMED_OUT = Symbol('timed out')

function queueSave(
  askBeforeCheck: boolean,
  revision: number,
  appliedLocally: Promise<unknown>
) {
  pendingSave = pendingSave.then(() =>
    persistAskBeforeCloudCheck(askBeforeCheck, revision, appliedLocally)
  )
  return pendingSave
}

function resendLatestChoice() {
  const latestChoice: boolean = useSettingStore().get(ASK_BEFORE_CLOUD_CHECK)
  void queueSave(latestChoice, latestRevision, Promise.resolve())
}

async function storeAskBeforeCloudCheck(
  askBeforeCheck: boolean,
  revision: number
) {
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
    const settleLateWrite = (landed: boolean) => {
      unsettledLateWrites -= 1
      if (!isLatestChoice(askBeforeCheck, revision)) {
        resendLatestChoice()
        return
      }
      if (landed && askBeforeCheck && unsettledLateWrites === 0)
        setPendingAskAgain(false)
    }
    request.then(
      (response) => settleLateWrite(response.ok),
      () => settleLateWrite(false)
    )
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
  revision: number,
  appliedLocally: Promise<unknown>
) {
  try {
    await appliedLocally
    if (!isCurrentChoice(askBeforeCheck)) return
    const failure = await storeAskBeforeCloudCheck(askBeforeCheck, revision)
    if (failure) {
      reportSaveFailure(failure, askBeforeCheck)
      return
    }
    if (
      askBeforeCheck &&
      unsettledLateWrites === 0 &&
      isLatestChoice(true, revision)
    )
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
  latestRevision += 1
  return queueSave(askBeforeCheck, latestRevision, appliedLocally)
}
