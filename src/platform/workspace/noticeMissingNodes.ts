import { until } from '@vueuse/core'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import { useWorkflowNeedsDeployment } from '@/platform/workspace/composables/useCustomDeploymentOffered'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { nodesNeedingDeployment } from '@/platform/workspace/missingForDeployment'
import {
  openWorkflowNeedsDeploymentDialog,
  preloadWorkflowNeedsDeploymentDialog
} from '@/platform/workspace/openCustomDeploymentDialog'
import { openWorkflowForCheck } from '@/platform/workspace/openWorkflowForCheck'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import {
  answersForWorkflow,
  workflowDeploymentOffer
} from '@/platform/workspace/workflowDeploymentOffer'
import type {
  CheckedWorkflow,
  MarkFor
} from '@/platform/workspace/workflowDeploymentOffer'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

/** How long the dialog waits for the compatibility check before it stays closed. */
export const COMPATIBILITY_WAIT_MS = 3000

function waitForListing(): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    useDeploymentPickStore().loadOnce(),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS)
    })
  ]).finally(() => clearTimeout(timeout))
}

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

function knowsWhatToOffer(
  markFor: MarkFor,
  workflow: CheckedWorkflow
): boolean {
  const deployments = useDeploymentPickStore().deployments
  return (
    deployments.length === 0 ||
    workflowDeploymentOffer(deployments, markFor, workflow).kind !== 'unchecked'
  )
}

async function offerCustomDeployment(
  missingNodes: readonly MissingNodeType[],
  markFor: MarkFor
): Promise<void> {
  const workflowStore = useWorkflowStore()
  const noticedWorkflow = workflowStore.activeWorkflow
  const checkedWorkflow = openWorkflowForCheck(missingNodes)
  const cardLoaded = preloadWorkflowNeedsDeploymentDialog()
  const needsDeployment = useWorkflowNeedsDeployment()
  await waitForListing()
  await compatibilityAnswered(markFor, checkedWorkflow)
  await cardLoaded
  if (
    workflowStore.activeWorkflow !== noticedWorkflow ||
    !needsDeployment.value ||
    !knowsWhatToOffer(markFor, checkedWorkflow)
  ) {
    return
  }
  await openWorkflowNeedsDeploymentDialog()
}

/**
 * Shows the error overlay for the open workflow's missing nodes and, on Comfy
 * Cloud, the deployment dialog over it once it knows what to offer.
 */
export async function noticeMissingNodes(
  nodeTypes: readonly MissingNodeType[],
  markFor: MarkFor
): Promise<void> {
  useExecutionErrorStore().showErrorOverlay()
  const missingNodes = nodesNeedingDeployment(nodeTypes)
  if (!useDeploymentSwitcherOffered().value || missingNodes.length === 0) return
  await offerCustomDeployment(missingNodes, markFor).catch((error: unknown) => {
    reportError(error, {
      errorType: 'error_offering_custom_deployment',
      surface: 'platform'
    })
  })
}
