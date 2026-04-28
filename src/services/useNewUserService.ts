import { ref, shallowRef } from 'vue'
import { createSharedComposable } from '@vueuse/core'
import { useSettingStore } from '@/platform/settings/settingStore'

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

    // Legacy keys (pre-V1 and V1 persistence)
    const hasNoLegacyWorkflow =
      !localStorage.getItem('workflow') &&
      !localStorage.getItem('Comfy.PreviousWorkflow')

    // V1 draft store keys
    const hasNoV1Drafts =
      !localStorage.getItem('Comfy.Workflow.Drafts') &&
      !localStorage.getItem('Comfy.Workflow.DraftOrder')

    // V2 draft index key (scoped to personal workspace; cloud workspace id
    // comes from sessionStorage which may not be set yet at this point)
    const hasNoV2DraftIndex = !localStorage.getItem(
      'Comfy.Workflow.DraftIndex.v2:personal'
    )

    return (
      isNewUserSettings &&
      hasNoLegacyWorkflow &&
      hasNoV1Drafts &&
      hasNoV2DraftIndex
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
