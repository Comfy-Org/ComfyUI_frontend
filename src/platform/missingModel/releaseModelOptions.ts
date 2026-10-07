import type { ReleaseModelOptions } from '@/platform/missingModel/missingModelScan'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useNodeDefStore } from '@/stores/nodeDefStore'

/**
 * A loader input's model options in the node catalog this page booted with,
 * when it booted on a developer-platform deployment (FE-2434): ingest served
 * that catalog from the deployment's Release. Waits for the boot listing
 * that says where the page runs (its request times out, so it always
 * settles) or until `signal` aborts; undefined on Comfy Cloud, when the
 * listing failed and when the check was aborted.
 */
export const releaseModelOptions: ReleaseModelOptions = async (
  nodeType,
  widgetName,
  signal
) => {
  const deploymentPick = useDeploymentPickStore()
  await settledOrAborted(deploymentPick.loadOnce(), signal)
  if (signal?.aborted || !deploymentPick.bootDeployment) return undefined
  const input = useNodeDefStore().getNodeDefByName(nodeType)?.inputs[widgetName]
  return input && isComboInputSpec(input) ? input.options : undefined
}

/** Resolves once `work` settles or `signal` aborts; never rejects. */
function settledOrAborted(
  work: Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    signal?.addEventListener('abort', done, { once: true })
    work.then(done, done)

    function done() {
      signal?.removeEventListener('abort', done)
      resolve()
    }
  })
}
