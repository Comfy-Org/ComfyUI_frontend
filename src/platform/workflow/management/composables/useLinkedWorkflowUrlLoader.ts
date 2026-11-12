import { useFolderWorkflowsUrlLoader } from '@/platform/workflow/management/composables/useFolderWorkflowsUrlLoader'
import { useWorkflowLinkUrlLoader } from '@/platform/workflow/management/composables/useWorkflowLinkUrlLoader'

/** Opens the workflow a boot URL links to: a workflow id first, else a folder. */
export function useLinkedWorkflowUrlLoader() {
  const workflowLinkUrlLoader = useWorkflowLinkUrlLoader()
  const folderWorkflowsUrlLoader = useFolderWorkflowsUrlLoader()

  async function openLinkedWorkflowFromUrl(): Promise<
    'opened' | 'pending' | 'none'
  > {
    const status = await workflowLinkUrlLoader.openWorkflowLinkFromUrl()
    if (status === 'absent') {
      const opened = await folderWorkflowsUrlLoader.openFolderWorkflowsFromUrl()
      return opened ? 'opened' : 'none'
    }
    return status === 'failed' ? 'none' : status
  }

  return { openLinkedWorkflowFromUrl }
}
