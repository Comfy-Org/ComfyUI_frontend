import { until } from '@vueuse/core'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { MissingNodeType } from '@/platform/nodeReplacement/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import {
  missingNodeTypeName,
  nodesNeedingDeployment
} from '@/platform/workspace/missingForDeployment'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { answersForMissingNodes } from '@/platform/workspace/workflowDeploymentOffer'
import type { MarkFor } from '@/platform/workspace/workflowDeploymentOffer'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

/** How long the dialog waits for the compatibility check before it opens without it. */
export const COMPATIBILITY_WAIT_MS = 3000

type Offered = 'dialog' | 'overlay' | 'superseded'

async function compatibilityAnswered(
  markFor: MarkFor,
  missingNodeTypes: readonly string[]
): Promise<void> {
  const asks =
    useFeatureFlags().flags.deploymentCompatibilityMarksEnabled &&
    useDeploymentPickStore().deployments.length > 0
  if (!asks) return
  await until(() => answersForMissingNodes(markFor, missingNodeTypes)).toBe(
    true,
    { timeout: COMPATIBILITY_WAIT_MS }
  )
}

async function offerCustomDeployment(
  nodeTypes: readonly MissingNodeType[],
  markFor: MarkFor
): Promise<Offered> {
  const workflowStore = useWorkflowStore()
  const workflow = workflowStore.activeWorkflow
  const store = useDeploymentPickStore()
  await store.loadOnce()
  if (!store.buildsVisible || store.bootDeployment !== null) return 'overlay'
  await compatibilityAnswered(
    markFor,
    nodesNeedingDeployment(nodeTypes).map(missingNodeTypeName)
  )
  if (workflowStore.activeWorkflow !== workflow) return 'superseded'
  return (await openWorkflowNeedsDeploymentDialog()) ? 'dialog' : 'overlay'
}

/**
 * Tells the user that a workflow just opened needs nodes this editor lacks.
 * On Comfy Cloud, to an account that may create Builds, nodes with no
 * replacement open the custom deployment dialog; otherwise the error overlay.
 */
export function noticeMissingNodes(
  nodeTypes: readonly MissingNodeType[],
  markFor: MarkFor
): void {
  const showOverlay = () => useExecutionErrorStore().showErrorOverlay()
  if (
    !useDeploymentSwitcherOffered().value ||
    nodesNeedingDeployment(nodeTypes).length === 0
  ) {
    showOverlay()
    return
  }
  offerCustomDeployment(nodeTypes, markFor).then(
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
