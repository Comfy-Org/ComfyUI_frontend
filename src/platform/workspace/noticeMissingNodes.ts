import { reportError } from '@comfyorg/telemetry/reportError'
import { DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import { useCustomDeploymentOffered } from '@/platform/workspace/composables/useCustomDeploymentOffered'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

function waitForListing(): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    useDeploymentPickStore().loadOnce(),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS)
    })
  ]).finally(() => clearTimeout(timeout))
}

async function offerCustomDeployment(): Promise<void> {
  const offered = useCustomDeploymentOffered(null)
  await waitForListing()
  if (offered.value) await openWorkflowNeedsDeploymentDialog()
}

/**
 * Shows the error overlay for the open workflow's missing nodes and, to a Comfy
 * Cloud workspace with no deployments, the custom deployment dialog over it.
 */
export async function noticeMissingNodes(): Promise<void> {
  useExecutionErrorStore().showErrorOverlay()
  if (!useDeploymentSwitcherOffered().value) return
  await offerCustomDeployment().catch((error: unknown) => {
    reportError(error, {
      errorType: 'error_offering_custom_deployment',
      surface: 'platform'
    })
  })
}
