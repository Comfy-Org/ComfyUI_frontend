import { ref, shallowRef } from 'vue'
import { createSharedComposable } from '@vueuse/core'
import { useSettingStore } from '@/platform/settings/settingStore'
import { safeLocalStorage } from '@/base/storage/safeStorage'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { reportError } from '@comfyorg/telemetry/reportError'

function hasV2DraftHistory(raw: string | null): boolean {
  if (!raw) return false
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    reportError(new Error('Workflow draft index is not valid JSON'), {
      surface: 'graph',
      errorType: 'error_parsing_workflow_draft_index',
      level: 'warning',
      context: { length: raw.length }
    })
    return false
  }
  if (!parsed || typeof parsed !== 'object') return false
  const { order, entries } = parsed as { order?: unknown; entries?: unknown }
  const orderLength = Array.isArray(order) ? order.length : 0
  const entriesCount =
    entries && typeof entries === 'object' ? Object.keys(entries).length : 0
  return orderLength > 0 || entriesCount > 0
}

function hasV2DraftHistoryInAnyWorkspace(): boolean {
  return safeLocalStorage
    .keys()
    .some(
      (key) =>
        key.startsWith(StorageKeys.prefixes.draftIndex) &&
        hasV2DraftHistory(safeLocalStorage.getItem(key))
    )
}

function _useNewUserService() {
  const settingStore = useSettingStore()
  const pendingCallbacks = shallowRef<Array<() => Promise<void>>>([])
  const isNewUserDetermined = ref(false)
  const isNewUserCached = ref<boolean | null>(null)

  function reset() {
    pendingCallbacks.value = []
    isNewUserDetermined.value = false
    isNewUserCached.value = null
  }

  function checkIsNewUser(): boolean {
    const isNewUserSettings =
      Object.keys(settingStore.settingValues).length === 0 ||
      !settingStore.get('Comfy.TutorialCompleted')

    const hasNoLegacyWorkflow =
      !safeLocalStorage.getItem('workflow') &&
      !safeLocalStorage.getItem('Comfy.PreviousWorkflow')

    const hasNoV1Drafts =
      !safeLocalStorage.getItem('Comfy.Workflow.Drafts') &&
      !safeLocalStorage.getItem('Comfy.Workflow.DraftOrder')

    return (
      isNewUserSettings &&
      hasNoLegacyWorkflow &&
      hasNoV1Drafts &&
      !hasV2DraftHistoryInAnyWorkspace()
    )
  }

  async function registerInitCallback(callback: () => Promise<void>) {
    if (isNewUserDetermined.value) {
      if (isNewUserCached.value) {
        try {
          await callback()
        } catch (error) {
          console.error('New user initialization callback failed:', error)
        }
      }
    } else {
      pendingCallbacks.value = [...pendingCallbacks.value, callback]
    }
  }

  async function initializeIfNewUser() {
    if (isNewUserDetermined.value) return

    isNewUserCached.value = checkIsNewUser()
    isNewUserDetermined.value = true

    if (!isNewUserCached.value) {
      pendingCallbacks.value = []
      return
    }

    await settingStore.set(
      'Comfy.InstalledVersion',
      __COMFYUI_FRONTEND_VERSION__
    )

    for (const callback of pendingCallbacks.value) {
      try {
        await callback()
      } catch (error) {
        console.error('New user initialization callback failed:', error)
      }
    }

    pendingCallbacks.value = []
  }

  function isNewUser(): boolean | null {
    return isNewUserDetermined.value ? isNewUserCached.value : null
  }

  return {
    registerInitCallback,
    initializeIfNewUser,
    isNewUser,
    reset
  }
}

export const useNewUserService = createSharedComposable(_useNewUserService)
