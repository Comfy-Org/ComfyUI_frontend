const SWITCH_RELOAD_KEY = 'Comfy.DeploymentSwitch.Reloading'

function markSwitchReload(): boolean {
  try {
    sessionStorage.setItem(SWITCH_RELOAD_KEY, '1')
    return true
  } catch {
    return false
  }
}

/**
 * Reloads the editor onto what this browser now runs on, marking the reload
 * so the next boot can say where it landed.
 */
export function reloadForDeploymentSwitch(): void {
  markSwitchReload()
  window.location.reload()
}

/** True while a deployment switch is reloading this tab. */
export function isReloadingForDeploymentSwitch(): boolean {
  try {
    return sessionStorage.getItem(SWITCH_RELOAD_KEY) !== null
  } catch {
    return false
  }
}

/** True once, on the first boot after a deployment switch reloaded this tab. */
export function takeDeploymentSwitchLanding(): boolean {
  const landed = isReloadingForDeploymentSwitch()
  try {
    sessionStorage.removeItem(SWITCH_RELOAD_KEY)
  } catch {
    return false
  }
  return landed
}
