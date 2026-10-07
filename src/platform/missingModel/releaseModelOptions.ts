import type { ReleaseModelOptions } from '@/platform/missingModel/missingModelScan'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useNodeDefStore } from '@/stores/nodeDefStore'

/**
 * How long a missing-model check waits for the boot listing before it takes
 * the page as running on Comfy Cloud and checks Cloud's model library.
 */
const BOOT_LISTING_WAIT_MS = 5_000

/**
 * A loader input's model options in the node catalog this page booted with,
 * when it booted on a developer-platform deployment (FE-2434): ingest served
 * that catalog from the deployment's Release. Waits for the boot listing
 * that says where the page runs, up to `BOOT_LISTING_WAIT_MS` and until
 * `signal` aborts; undefined on Comfy Cloud and when the listing has not
 * answered by then.
 */
export const releaseModelOptions: ReleaseModelOptions = async (
  nodeType,
  widgetName,
  signal
) => {
  const deploymentPick = useDeploymentPickStore()
  await settledWithin(deploymentPick.loadOnce(), BOOT_LISTING_WAIT_MS, signal)
  if (signal?.aborted || !deploymentPick.bootDeployment) return undefined
  const input = useNodeDefStore().getNodeDefByName(nodeType)?.inputs[widgetName]
  return input && isComboInputSpec(input) ? input.options : undefined
}

/** Resolves once `work` settles, `ms` pass or `signal` aborts. */
function settledWithin(
  work: Promise<void>,
  ms: number,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms)
    signal?.addEventListener('abort', done, { once: true })
    void work.finally(done)

    function done() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
  })
}
