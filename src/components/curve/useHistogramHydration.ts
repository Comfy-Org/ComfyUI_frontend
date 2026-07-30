import { getJobDetail } from '@/services/jobOutputCache'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'
import { executionIdToNodeLocatorId } from '@/utils/graphTraversalUtil'

/**
 * Restores a curve/range widget's histogram from the most recent job history
 * entry when the in-memory nodeOutputStore has nothing for it yet, e.g. right
 * after a page refresh wipes the websocket-populated store.
 */
export async function hydrateHistogramFromHistory(
  nodeLocatorId: NodeLocatorId
): Promise<void> {
  const nodeOutputStore = useNodeOutputStore()
  if (nodeOutputStore.nodeOutputs[nodeLocatorId]?.histogram) return

  const [latestJob] = await api.getHistory(1)
  if (!latestJob) return

  const jobDetail = await getJobDetail(latestJob.id)
  if (!jobDetail?.outputs) return

  for (const [rawExecutionId, output] of Object.entries(jobDetail.outputs)) {
    if (
      executionIdToNodeLocatorId(app.rootGraph, rawExecutionId) !==
      nodeLocatorId
    )
      continue

    const executionId = tryNormalizeNodeExecutionId(rawExecutionId)
    if (!executionId || output?.histogram === undefined) return

    nodeOutputStore.setNodeOutputsByExecutionId(
      executionId,
      { histogram: output.histogram },
      { merge: true }
    )
    return
  }
}
