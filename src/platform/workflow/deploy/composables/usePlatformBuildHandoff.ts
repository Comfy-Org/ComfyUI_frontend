import { z } from 'zod'

import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { isCloud, isDesktop } from '@/platform/distribution/types'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'

const zCloudWorkflowList = z.object({
  data: z.array(z.object({ id: z.string(), name: z.string().optional() }))
})

function platformBuildImportUrl(cloudWorkflowId?: string): string {
  const url = new URL('/profile/builds/new', getComfyPlatformBaseUrl())
  url.searchParams.set('step', 'import')
  if (cloudWorkflowId) url.searchParams.set('workflow', cloudWorkflowId)
  return url.href
}

/** The name Cloud gives a workflow saved as `workflows/<name>.json`. */
function cloudWorkflowName(workflow: ComfyWorkflow): string {
  return workflow.path.replace(/^workflows\//, '').replace(/\.json$/i, '')
}

async function findCloudWorkflowId(name: string): Promise<string | undefined> {
  const response = await api.fetchApi(
    `/workflows?name=${encodeURIComponent(name)}&limit=50`
  )
  if (!response.ok) return undefined
  const parsed = zCloudWorkflowList.safeParse(await response.json())
  if (!parsed.success) return undefined
  return parsed.data.data.find((entry) => entry.name === name)?.id
}

/**
 * Opens the platform's build wizard on its import step with the open
 * workflow already picked. On Cloud the saved workflow is in the workspace
 * library the wizard reads, so its id goes in the link; elsewhere there is
 * no Cloud copy, so the workflow file is exported for the wizard's drop zone.
 */
export function usePlatformBuildHandoff() {
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()

  async function resolveUrl(): Promise<string> {
    const workflow = workflowStore.activeWorkflow
    if (!workflow) return platformBuildImportUrl()

    if (!isCloud) {
      await workflowService.exportWorkflow(
        cloudWorkflowName(workflow),
        'workflow'
      )
      return platformBuildImportUrl()
    }

    const needsSave = workflow.isTemporary || workflow.isModified
    if (needsSave && !(await workflowService.saveWorkflow(workflow))) {
      return platformBuildImportUrl()
    }
    return platformBuildImportUrl(
      await findCloudWorkflowId(cloudWorkflowName(workflow))
    )
  }

  /**
   * Call from the click handler: in a browser the tab opens on the gesture
   * itself, then lands where the workflow is once the save and lookup have
   * finished. Desktop hands every new window to the system browser, so it
   * gets the resolved link in one go.
   */
  async function open(): Promise<void> {
    const tab = isDesktop ? null : window.open('', '_blank')
    const url = await resolveUrl()
    if (tab) tab.location.href = url
    else window.open(url, '_blank', 'noopener')
  }

  return { open }
}
