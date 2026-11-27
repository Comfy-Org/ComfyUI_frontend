import { toRaw } from 'vue'
import { extractWorkflow } from '@comfyorg/api-client/jobs/fetchJobs'
import type { TaskItemImpl } from '@comfyorg/api-client/jobs/taskItem'
import type { ComfyApp } from '@/types/comfy'
import { useExtensionServiceAccess } from '@/platform/extensions/services/extensionServiceAccess'
import { getJobDetail } from '@/platform/queue/services/jobOutputCache'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { tryNormalizeNodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'
export async function loadJobWorkflow(task: TaskItemImpl, app: ComfyApp) {
  if (!task.isHistory) {
    return
  }
  const jobDetail = await getJobDetail(task.jobId)
  const workflowData = await extractWorkflow(jobDetail)
  if (!workflowData) {
    return
  }
  const loaded = await app.loadGraphData(toRaw(workflowData))
  if (loaded === false) return
  const outputsToLoad = jobDetail?.outputs ?? task.outputs
  const nodeOutputsStore = useNodeOutputStore()
  const rawOutputs = toRaw(outputsToLoad)
  for (const rawNodeExecutionId in rawOutputs) {
    const nodeExecutionId = tryNormalizeNodeExecutionId(rawNodeExecutionId)
    if (!nodeExecutionId) continue
    nodeOutputsStore.setNodeOutputsByExecutionId(
      nodeExecutionId,
      rawOutputs[rawNodeExecutionId]
    )
  }
  useExtensionServiceAccess().invokeExtensions(
    'onNodeOutputsUpdated',
    app.nodeOutputs
  )
}
