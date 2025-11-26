import type { useSettingStore } from '@/platform/settings/settingStore'

let pendingCallbacks: Array<() => Promise<void>> = []
let isNewUserDetermined = false
let isNewUserCached: boolean | null = null
// Temporary override to always treat dev builds as "new user" for local testing
const devForceNewUser = import.meta.env.DEV

export const newUserService = () => {
  function checkIsNewUser(
    settingStore: ReturnType<typeof useSettingStore>
  ): boolean {
    if (devForceNewUser) {
      return true
    }

    const isNewUserSettings =
      Object.keys(settingStore.settingValues).length === 0 ||
      !settingStore.get('Comfy.TutorialCompleted')
    const hasNoWorkflow = !localStorage.getItem('workflow')
    const hasNoPreviousWorkflow = !localStorage.getItem(
      'Comfy.PreviousWorkflow'
    )

    return isNewUserSettings && hasNoWorkflow && hasNoPreviousWorkflow
  }

  async function registerInitCallback(callback: () => Promise<void>) {
    if (isNewUserDetermined) {
      if (isNewUserCached) {
        try {
          await callback()
        } catch (error) {
          console.error('New user initialization callback failed:', error)
        }
      }
    } else {
      pendingCallbacks.push(callback)
    }
  }

  async function initializeIfNewUser(
    settingStore: ReturnType<typeof useSettingStore>
  ) {
    if (isNewUserDetermined) return

    isNewUserCached = checkIsNewUser(settingStore)
    isNewUserDetermined = true

    if (devForceNewUser) {
      localStorage.removeItem('workflow')
      localStorage.removeItem('Comfy.PreviousWorkflow')
      try {
        await settingStore.set('Comfy.TutorialCompleted', false)
      } catch (error) {
        console.error('[newUserService] Failed to reset tutorial flag', error)
      }
    }

    if (!isNewUserCached) {
      pendingCallbacks = []
      return
    }

    await settingStore.set(
      'Comfy.InstalledVersion',
      __COMFYUI_FRONTEND_VERSION__
    )

    for (const callback of pendingCallbacks) {
      try {
        await callback()
      } catch (error) {
        console.error('New user initialization callback failed:', error)
      }
    }

    pendingCallbacks = []
  }

  function isNewUser(): boolean | null {
    return isNewUserDetermined ? isNewUserCached : null
  }

  return {
    registerInitCallback,
    initializeIfNewUser,
    isNewUser
  }
}
