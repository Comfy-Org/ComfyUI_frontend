import type { useSettingStore } from '@/stores/settingStore'

export const newUserService = () => {
  let isNewUserDetermined = false
  let isNewUserCached: boolean | null = null
  let pendingCallbacks: Array<() => Promise<void>> = []

  function checkIsNewUser(
    settingStore: ReturnType<typeof useSettingStore>
  ): boolean {
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

    console.log(`New user status determined: ${isNewUserCached}`)

    isNewUserDetermined = true

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
