const SWITCH_LANDING_KEY = 'Comfy.DeploymentSwitch.Reloading'

function forgetSwitchLanding() {
  try {
    sessionStorage.removeItem(SWITCH_LANDING_KEY)
  } catch {
    return
  }
}

function markSwitchLanding(): boolean {
  try {
    sessionStorage.setItem(SWITCH_LANDING_KEY, '1')
    return true
  } catch {
    return false
  }
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

/**
 * Reloads the editor onto what this browser now runs on and marks the reload
 * so the next boot can say where it landed. `onStay` runs on the next
 * interaction if the page stays, as when the user stays at the leave prompt.
 */
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
  try {
    const landed = sessionStorage.getItem(SWITCH_LANDING_KEY) !== null
    sessionStorage.removeItem(SWITCH_LANDING_KEY)
    return landed
  } catch {
    return false
  }
}
