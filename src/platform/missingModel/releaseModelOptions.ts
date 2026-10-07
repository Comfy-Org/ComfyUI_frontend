import type { ReleaseModelOptions } from '@/platform/missingModel/missingModelScan'
import { DEPLOYMENT_LISTING_BACKSTOP_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useNodeDefStore } from '@/stores/nodeDefStore'

/**
 * A loader input's model options in the node catalog this page booted with,
 * when it booted on a developer-platform deployment (FE-2434): ingest served
 * that catalog from the deployment's Release. Waits for the boot listing
 * that says where the page runs, at most `DEPLOYMENT_LISTING_BACKSTOP_MS`
 * (its sign-in step can hang before the request timeout starts), or until
 * `signal` aborts; undefined on Comfy Cloud, when the listing failed or did
 * not answer in time, and when the check was aborted.
 */
export const releaseModelOptions: ReleaseModelOptions = async (
  nodeType,
  widgetName,
  signal
) => {
  const deploymentPick = useDeploymentPickStore()
  await settledWithin(
    deploymentPick.loadOnce(),
    DEPLOYMENT_LISTING_BACKSTOP_MS,
    signal
  )
  if (signal?.aborted || !deploymentPick.bootDeployment) return undefined
  const input = useNodeDefStore().getNodeDefByName(nodeType)?.inputs[widgetName]
  return input && isComboInputSpec(input) ? input.options : undefined
}

/**
 * Resolves once `work` settles, `ceilingMs` passes or `signal` aborts; never
 * rejects.
 */
function settledWithin(
  work: Promise<void>,
  ceilingMs: number,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const ceiling = setTimeout(done, ceilingMs)
    signal?.addEventListener('abort', done, { once: true })
    work.then(done, done)

    function done() {
      clearTimeout(ceiling)
      signal?.removeEventListener('abort', done)
      resolve()
    }
  })
}
