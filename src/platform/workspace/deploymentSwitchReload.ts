import { safeSessionStorage } from '@comfyorg/shared-frontend-utils/safeStorage'

const SWITCH_LANDING_KEY = 'Comfy.DeploymentSwitch.Reloading'

function forgetSwitchLanding() {
  safeSessionStorage.removeItem(SWITCH_LANDING_KEY)
}

function markSwitchLanding() {
  safeSessionStorage.setItem(SWITCH_LANDING_KEY, '1')
}

let stayWatch = new AbortController()

function onNextInteraction(callback: () => void) {
  stayWatch.abort()
  const controller = new AbortController()
  stayWatch = controller
  const run = () => {
    controller.abort()
    callback()
  }
  for (const type of ['pointerdown', 'keydown']) {
    window.addEventListener(type, run, {
      capture: true,
      signal: controller.signal
    })
  }
}

/** Reloads for a switch; `onStay` runs on the next interaction if it stays. */
export function reloadForDeploymentSwitch(onStay: () => void): void {
  markSwitchLanding()
  onNextInteraction(() => {
    forgetSwitchLanding()
    onStay()
  })
  window.location.reload()
}

/** True once, on the first boot after a deployment switch reloaded this tab. */
export function takeDeploymentSwitchLanding(): boolean {
  const landed = safeSessionStorage.getItem(SWITCH_LANDING_KEY) !== null
  return safeSessionStorage.remove(SWITCH_LANDING_KEY).ok && landed
}
