import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

const SWITCH_LANDING_KEY = 'Comfy.DeploymentSwitch.Reloading'

/** Unsaved workflows the user chose to drop on a switch, each with the state they agreed to lose. */
export type DiscardedWork = ReadonlyMap<ComfyWorkflow, ComfyWorkflowJSON | null>

export const NOTHING_DISCARDED: DiscardedWork = new Map()

let pendingDiscard: DiscardedWork | null = null

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
 * so the next boot can say where it landed. The leave prompt skips only the
 * work in `discarded`; `onStay` runs on the next interaction if the page stays.
 */
export function reloadForDeploymentSwitch(
  discarded: DiscardedWork,
  onStay: () => void
): void {
  markSwitchLanding()
  pendingDiscard = discarded
  onNextInteraction(() => {
    forgetSwitchLanding()
    onStay()
  })
  window.location.reload()
}

/** The work a switch reload let go, once, for the unload it caused; null for any other unload. */
export function takeDeploymentSwitchDiscard(): DiscardedWork | null {
  const discarded = pendingDiscard
  pendingDiscard = null
  return discarded
}

/**
 * True when a switch reload may drop this workflow: it is not loaded, so
 * nothing of it is in memory, or the user chose to drop its state as it is now.
 */
export function wasDiscardedOnSwitch(
  discarded: DiscardedWork | null,
  workflow: ComfyWorkflow
): boolean {
  if (discarded === null) return false
  return !workflow.isLoaded || discarded.get(workflow) === workflow.activeState
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
