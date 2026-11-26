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

export const LATEST_CHOICE_KEY =
  'Comfy.Cloud.AskBeforeCompatibilityCheck.LatestChoice'

interface LatestChoice {
  askBeforeCheck: boolean
  revision: number
}

let pendingSave: Promise<void> = Promise.resolve()
let unsettledLateWrites = 0
const choicesInThisTab = new Map<string, LatestChoice>()

function currentProfile() {
  return api.user
}

function keyForCurrentProfile(key: string) {
  const profile = currentProfile()
  return profile ? `${key}.${profile}` : key
}

function choiceInThisTab() {
  return choicesInThisTab.get(currentProfile())
}

function parseLatestChoice(raw: string | null): LatestChoice | undefined {
  if (!raw) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'askBeforeCheck' in parsed &&
      'revision' in parsed &&
      typeof parsed.askBeforeCheck === 'boolean' &&
      typeof parsed.revision === 'number'
    )
      return {
        askBeforeCheck: parsed.askBeforeCheck,
        revision: parsed.revision
      }
  } catch {
    return undefined
  }
  return undefined
}

function readLatestChoice(): LatestChoice | undefined {
  const shared = parseLatestChoice(
    safeLocalStorage.getItem(keyForCurrentProfile(LATEST_CHOICE_KEY))
  )
  const inThisTab = choiceInThisTab()
  if (!shared) return inThisTab
  if (!inThisTab || shared.revision >= inThisTab.revision) return shared
  return inThisTab
}

function recordNewChoice(askBeforeCheck: boolean): LatestChoice {
  const previousRevision = readLatestChoice()?.revision ?? 0
  const choice = {
    askBeforeCheck,
    revision: Math.max(Date.now(), previousRevision + 1)
  }
  choicesInThisTab.set(currentProfile(), choice)
  safeLocalStorage.setItem(
    keyForCurrentProfile(LATEST_CHOICE_KEY),
    JSON.stringify(choice)
  )
  return choice
}

function hasPendingAskAgain() {
  return (
    safeLocalStorage.getItem(keyForCurrentProfile(PENDING_ASK_AGAIN_KEY)) ===
    'true'
  )
}

function setPendingAskAgain(pending: boolean) {
  if (pending)
    safeLocalStorage.setItem(
      keyForCurrentProfile(PENDING_ASK_AGAIN_KEY),
      'true'
    )
  else safeLocalStorage.removeItem(keyForCurrentProfile(PENDING_ASK_AGAIN_KEY))
}

export function skipsCloudCheckQuestion() {
  if (hasPendingAskAgain()) {
    void saveAskBeforeCloudCheck(true)
    return false
  }
  const savedAsk: unknown = useSettingStore().get(ASK_BEFORE_CLOUD_CHECK)
  const latestAsk = readLatestChoice()?.askBeforeCheck ?? false
  return savedAsk === false && !latestAsk
}

function isLatestChoice(askBeforeCheck: boolean, revision: number) {
  const latest = readLatestChoice()
  return (
    latest?.revision === revision && latest.askBeforeCheck === askBeforeCheck
  )
}

function isCurrentChoice(askBeforeCheck: boolean) {
  const latest = readLatestChoice()
  if (latest) return latest.askBeforeCheck === askBeforeCheck
  return useSettingStore().get(ASK_BEFORE_CLOUD_CHECK) === askBeforeCheck
}

const TIMED_OUT = Symbol('timed out')

function queueSave(
  askBeforeCheck: boolean,
  revision: number,
  appliedLocally: Promise<unknown>
) {
  setPendingAskAgain(askBeforeCheck)
  pendingSave = pendingSave.then(() =>
    persistAskBeforeCloudCheck(askBeforeCheck, revision, appliedLocally)
  )
  return pendingSave
}

function resendLatestChoice() {
  const latest = readLatestChoice()
  if (!latest) return
  const appliedLocally = useSettingStore().applySettingLocally(
    ASK_BEFORE_CLOUD_CHECK,
    latest.askBeforeCheck
  )
  void queueSave(latest.askBeforeCheck, latest.revision, appliedLocally)
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

function settleSavedChoice(askBeforeCheck: boolean, revision: number) {
  if (!isLatestChoice(askBeforeCheck, revision)) {
    if (readLatestChoice()?.revision !== choiceInThisTab()?.revision)
      resendLatestChoice()
    return
  }
  if (askBeforeCheck && unsettledLateWrites === 0) setPendingAskAgain(false)
}

async function persistAskBeforeCloudCheck(
  askBeforeCheck: boolean,
  revision: number,
  appliedLocally: Promise<unknown>
) {
  try {
    await appliedLocally
    if (!isLatestChoice(askBeforeCheck, revision)) return
    const failure = await storeAskBeforeCloudCheck(askBeforeCheck, revision)
    if (failure) {
      reportSaveFailure(failure, askBeforeCheck)
      return
    }
    settleSavedChoice(askBeforeCheck, revision)
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
  const { revision } = recordNewChoice(askBeforeCheck)
  return queueSave(askBeforeCheck, revision, appliedLocally)
}
