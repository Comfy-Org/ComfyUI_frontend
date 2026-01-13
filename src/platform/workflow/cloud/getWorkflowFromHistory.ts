import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { PromptId } from '@/schemas/apiSchema'

export async function getWorkflowFromHistory(
  fetchApi: (url: string) => Promise<Response>,
  promptId: PromptId
): Promise<ComfyWorkflowJSON | undefined> {
  try {
    const res = await fetchApi(`/history_v2/${promptId}`)
    const json = await res.json()

    const historyItem = json[promptId]
    if (!historyItem) return undefined

    const workflow = historyItem.prompt?.extra_data?.extra_pnginfo?.workflow
    return workflow ?? undefined
  } catch (error) {
    console.error(`Failed to fetch workflow for prompt ${promptId}:`, error)
    return undefined
  }
}
