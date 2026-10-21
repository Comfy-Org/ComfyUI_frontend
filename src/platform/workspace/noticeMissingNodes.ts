import { until } from '@vueuse/core'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { nodesNeedingDeployment } from '@/platform/workspace/missingForDeployment'
import {
  openWorkflowNeedsDeploymentDialog,
  preloadWorkflowNeedsDeploymentDialog
} from '@/platform/workspace/openCustomDeploymentDialog'
import { openWorkflowForCheck } from '@/platform/workspace/openWorkflowForCheck'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { answersForWorkflow } from '@/platform/workspace/workflowDeploymentOffer'
import type {
  CheckedWorkflow,
  MarkFor
} from '@/platform/workspace/workflowDeploymentOffer'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

/** How long the dialog waits for the compatibility check before it opens without it. */
export const COMPATIBILITY_WAIT_MS = 3000

type Offered = 'dialog' | 'overlay' | 'superseded'

async function compatibilityAnswered(
  markFor: MarkFor,
  workflow: CheckedWorkflow
): Promise<void> {
  const asks =
    useFeatureFlags().flags.deploymentCompatibilityMarksEnabled &&
    useDeploymentPickStore().deployments.length > 0
  if (!asks) return
  await until(() => answersForWorkflow(markFor, workflow)).toBe(true, {
    timeout: COMPATIBILITY_WAIT_MS
  })
}

async function offerCustomDeployment(
  missingNodes: readonly MissingNodeType[],
  markFor: MarkFor
): Promise<Offered> {
  const workflowStore = useWorkflowStore()
  const noticedWorkflow = workflowStore.activeWorkflow
  const checkedWorkflow = openWorkflowForCheck(missingNodes)
  const cardLoaded = preloadWorkflowNeedsDeploymentDialog()
  const store = useDeploymentPickStore()
  await store.loadOnce()
  if (!store.isVisible || store.bootDeployment !== null) return 'overlay'
  await compatibilityAnswered(markFor, checkedWorkflow)
  await cardLoaded
  if (workflowStore.activeWorkflow !== noticedWorkflow) return 'superseded'
  return (await openWorkflowNeedsDeploymentDialog()) ? 'dialog' : 'overlay'
}

/**
 * Tells the user that a workflow just opened needs nodes this editor lacks.
 * On Comfy Cloud, to an account served the deployments listing, nodes with no
 * replacement open the custom deployment dialog; otherwise the error overlay.
 */
export function noticeMissingNodes(
  nodeTypes: readonly MissingNodeType[],
  markFor: MarkFor
): void {
  const showOverlay = () => useExecutionErrorStore().showErrorOverlay()
  const missingNodes = nodesNeedingDeployment(nodeTypes)
  if (!useDeploymentSwitcherOffered().value || missingNodes.length === 0) {
    showOverlay()
    return
  }
  offerCustomDeployment(missingNodes, markFor).then(
    (offered) => {
      if (offered === 'overlay') showOverlay()
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
