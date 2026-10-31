const SWITCH_LANDING_KEY = 'Comfy.DeploymentSwitch.Reloading'

function forgetSwitchLanding() {
  try {
    sessionStorage.removeItem(SWITCH_LANDING_KEY)
  } catch {
    return
  }
}

function markSwitchLanding() {
  try {
    sessionStorage.setItem(SWITCH_LANDING_KEY, '1')
  } catch {
    return
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
  try {
    const landed = sessionStorage.getItem(SWITCH_LANDING_KEY) !== null
    sessionStorage.removeItem(SWITCH_LANDING_KEY)
    return landed
  } catch {
    return false
  }
}
