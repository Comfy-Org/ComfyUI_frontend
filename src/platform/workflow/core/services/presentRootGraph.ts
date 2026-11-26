import type { LGraph } from '@comfyorg/litegraph/litegraph'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import type { ComfyApp } from '@/types/comfy'

/** Drop the visible graph's run errors and asset warnings, then show `graph` on the canvas when `clean`. */
export function presentRootGraph(
  app: Pick<ComfyApp, 'activateRootGraph'>,
  graph: LGraph,
  { clean, skipAssetScans }: { clean: boolean; skipAssetScans: boolean }
): void {
  useExecutionErrorStore().setActiveGraph(null)
  if (skipAssetScans) {
    useMissingModelStore().createVerificationAbortController().abort()
    useMissingMediaStore().createVerificationAbortController().abort()
    useMissingModelStore().setMissingModels([])
    useMissingMediaStore().setMissingMedia([])
  } else {
    useMissingModelStore().clearMissingModels()
    useMissingMediaStore().clearMissingMedia()
  }
  if (!clean) return
  useSubgraphNavigationStore().suppressRootGraphHash(graph)
  app.activateRootGraph(graph)
}
