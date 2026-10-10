import { useEventListener } from '@vueuse/core'

import { useNodeProgressText } from '@/composables/node/useNodeProgressText'
import type { ProgressTextWsMessage } from '@/platform/remote/comfyui/execution/types'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { api } from '@/scripts/api'
import type { QueuedJob } from '@/stores/executionStore'
import { useExecutionStore } from '@/stores/executionStore'
import { parseNodeId } from '@/types/nodeId'

export function useProgressTextPreviews() {
  const executionStore = useExecutionStore()
  const workflowStore = useWorkflowStore()
  const canvasStore = useCanvasStore()
  const { showTextPreview, removeTextPreview } = useNodeProgressText()

  function findNode(currentId: string | undefined) {
    if (!currentId) return
    const nodeId = parseNodeId(currentId)
    if (!nodeId) return
    return canvasStore.canvas?.graph?.getNodeById(nodeId) ?? undefined
  }

  function handleProgressText(e: CustomEvent<ProgressTextWsMessage>) {
    const { nodeId, text, prompt_id } = e.detail
    if (!text || !nodeId) return

    // The ownership gate, not a bare activeJobId comparison: activeJobId can
    // name a job belonging to another open workflow, which both drops frames
    // for the tab in front and lets a background job's text land on it. The
    // gate falls back to the activeJobId check only when ownership cannot be
    // resolved at all. No workflow id to pass: core packs progress_text as a
    // binary frame that carries none, tracked in Comfy-Org/ComfyUI#16887.
    if (!executionStore.belongsToActiveWorkflow(prompt_id, undefined)) return

    const executionId = String(nodeId)
    const currentId = executionId.includes(':')
      ? workflowStore.executionIdToCurrentId(executionId)
      : executionId
    const node = findNode(currentId)
    if (node) showTextPreview(node, text)
  }

  function clearTextPreviews(job: QueuedJob) {
    if (!job.workflow || job.workflow !== workflowStore.activeWorkflow) return

    for (const executionId of Object.keys(job.nodes)) {
      const node = findNode(workflowStore.executionIdToCurrentId(executionId))
      if (node) removeTextPreview(node)
    }
  }

  useEventListener(api, 'progress_text', handleProgressText)
  executionStore.onJobReset(clearTextPreviews)
}
