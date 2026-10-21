import { until } from '@vueuse/core'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { MissingNodeType } from '@/platform/nodeReplacement/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { nodesNeedingDeployment } from '@/platform/workspace/missingForDeployment'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

/** How long the dialog waits for the compatibility check before it opens without it. */
export const COMPATIBILITY_WAIT_MS = 3000

async function compatibilityAnswered(): Promise<void> {
  const asks =
    useFeatureFlags().flags.deploymentCompatibilityMarksEnabled &&
    useDeploymentPickStore().deployments.length > 0
  if (!asks) return
  await until(useDeploymentCompatibility().compatibility).toBeTruthy({
    timeout: COMPATIBILITY_WAIT_MS
  })
}

async function offerCustomDeployment(): Promise<boolean> {
  const store = useDeploymentPickStore()
  await store.loadOnce()
  if (!store.buildsVisible || store.bootDeployment !== null) return false
  await compatibilityAnswered()
  return openWorkflowNeedsDeploymentDialog()
}

/**
 * Tells the user that a workflow just opened needs nodes this editor lacks.
 * On Comfy Cloud, to an account that may create Builds, nodes with no
 * replacement open the custom deployment dialog; otherwise the error overlay.
 */
export function noticeMissingNodes(
  nodeTypes: readonly MissingNodeType[]
): void {
  const showOverlay = () => useExecutionErrorStore().showErrorOverlay()
  if (
    !useDeploymentSwitcherOffered().value ||
    nodesNeedingDeployment(nodeTypes).length === 0
  ) {
    showOverlay()
    return
  }
  offerCustomDeployment().then(
    (opened) => {
      if (!opened) showOverlay()
    },
    (error: unknown) => {
      reportError(error, {
        errorType: 'error_offering_custom_deployment',
        surface: 'platform'
      })
      showOverlay()
    }
  )
}
