import type { ReleaseModelOptions } from '@/platform/missingModel/missingModelScan'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useNodeDefStore } from '@/stores/nodeDefStore'

/**
 * A loader input's model options in the node catalog this page booted with,
 * when it booted on a developer-platform deployment (FE-2434): ingest served
 * that catalog from the deployment's Release. Waits for the boot listing
 * that says where the page runs; undefined on Comfy Cloud.
 */
export const releaseModelOptions: ReleaseModelOptions = async (
  nodeType,
  widgetName
) => {
  const deploymentPick = useDeploymentPickStore()
  await deploymentPick.loadOnce()
  if (!deploymentPick.bootDeployment) return undefined
  const input = useNodeDefStore().getNodeDefByName(nodeType)?.inputs[widgetName]
  return input && isComboInputSpec(input) ? input.options : undefined
}
