import { sortBy } from 'es-toolkit'
import { useRoute, useRouter } from 'vue-router'

import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'

function isFolderName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value !== '' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.includes('..')
  )
}

/**
 * Opens the saved workflows of the folder a link names (BE-21147):
 * `?workflows=<folder>` opens every `.json` directly in `workflows/<folder>/`
 * as a tab, in name order, with the first in front. A tab already open is
 * reused. A folder name that is not one path segment, or a folder with no
 * workflows, opens nothing. The param is then dropped, except while a Cloud
 * deployment link is still to pick, since that pick reloads the page and the
 * boot after it opens the folder again.
 */
export function useFolderWorkflowsUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const workflowStore = useWorkflowStore()

  function workflowsIn(folder: string): ComfyWorkflow[] {
    const prefix = `${ComfyWorkflow.basePath}${folder}/`
    const inFolder = workflowStore.persistedWorkflows.filter(({ path }) => {
      const name = path.slice(prefix.length)
      return (
        path.startsWith(prefix) && name.endsWith('.json') && !name.includes('/')
      )
    })
    return sortBy(inFolder, [(workflow) => workflow.path])
  }

  async function openInFront(folder: string): Promise<boolean> {
    try {
      await workflowStore.loadWorkflows()
      const workflows = workflowsIn(folder)
      if (workflows.length === 0) return false
      workflowStore.openWorkflowsInBackground({
        right: workflows.map((workflow) => workflow.path)
      })
      return await useWorkflowService().openWorkflow(workflows[0])
    } catch (error) {
      reportError(error, {
        surface: 'graph',
        errorType: 'error_opening_link_folder_workflows'
      })
      return false
    }
  }

  function dropParam() {
    if (isCloud && 'deployment' in route.query) return
    const query = { ...route.query }
    delete query.workflows
    void router.replace({ query })
  }

  /**
   * Opens the linked folder's workflows. Resolves true when one of them is
   * now the active workflow.
   */
  async function openFolderWorkflowsFromUrl(): Promise<boolean> {
    if (!('workflows' in route.query)) return false
    const folder = route.query.workflows
    const opened = isFolderName(folder) && (await openInFront(folder))
    dropParam()
    return opened
  }

  return { openFolderWorkflowsFromUrl }
}
