import { useRoute, useRouter } from 'vue-router'

import { isCloud } from '@/platform/distribution/types'
import {
  clearPreservedQuery,
  getPreservedQueryParam,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'

const WORKFLOWS_NAMESPACE = PRESERVED_QUERY_NAMESPACES.WORKFLOWS
const DEPLOYMENT_NAMESPACE = PRESERVED_QUERY_NAMESPACES.DEPLOYMENT

function isFolderName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value !== '' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.includes('..') &&
    !value.includes(',')
  )
}

/**
 * Opens the saved workflows of the folder a link names:
 * `?workflows=<folder>` opens every `.json` directly in `workflows/<folder>/`
 * as a tab, in natural name order, with the first in front. A tab already
 * open is reused and keeps its place, so the folder's tabs may sit among
 * tabs that were open before. A folder name that is not one path segment, a
 * repeated or bare param (which the preserved-query tracker stashes joined
 * with `,`), or a folder with no workflows, opens nothing. If the first
 * workflow fails to open, the tabs are left as they were. The param survives
 * the sign-in and onboarding redirects through the preserved-query stash. It
 * is then dropped, stash included, except while a Cloud deployment link (in
 * the URL or its own stash) is still to pick, since that pick reloads the page
 * and the boot after it opens the folder again.
 */
export function useFolderWorkflowsUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const workflowStore = useWorkflowStore()

  function workflowsIn(folder: string): ComfyWorkflow[] {
    const prefix = `${ComfyWorkflow.basePath}${folder}/`
    const inFolder = workflowStore.persistedWorkflows.filter(({ path }) => {
      if (!path.startsWith(prefix)) return false
      const name = path.slice(prefix.length)
      return name.endsWith('.json') && !name.includes('/')
    })
    return inFolder.sort((a, b) =>
      a.fullFilename.localeCompare(b.fullFilename, undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    )
  }

  async function openInFront(folder: string): Promise<boolean> {
    try {
      await workflowStore.loadWorkflows()
      const workflows = workflowsIn(folder)
      if (workflows.length === 0) return false
      const opened = await useWorkflowService().openWorkflow(workflows[0])
      if (!opened) return false
      workflowStore.openWorkflowsInBackground({
        right: workflows.map((workflow) => workflow.path)
      })
      return true
    } catch (error) {
      reportError(error, {
        surface: 'graph',
        errorType: 'error_opening_link_folder_workflows'
      })
      return false
    }
  }

  function linkQuery() {
    hydratePreservedQuery(WORKFLOWS_NAMESPACE)
    return (
      mergePreservedQueryIntoQuery(WORKFLOWS_NAMESPACE, route.query) ??
      route.query
    )
  }

  function deploymentLinkPending(): boolean {
    return (
      'deployment' in route.query ||
      getPreservedQueryParam(DEPLOYMENT_NAMESPACE, 'deployment') !== undefined
    )
  }

  function dropParam() {
    if (isCloud && deploymentLinkPending()) return
    clearPreservedQuery(WORKFLOWS_NAMESPACE)
    if (!('workflows' in route.query)) return
    const query = { ...route.query }
    delete query.workflows
    void router.replace({ query })
  }

  /**
   * Opens the linked folder's workflows. Resolves true when one of them is
   * now the active workflow.
   */
  async function openFolderWorkflowsFromUrl(): Promise<boolean> {
    const query = linkQuery()
    if (!('workflows' in query)) return false
    const folder = query.workflows
    const opened = isFolderName(folder) && (await openInFront(folder))
    dropParam()
    return opened
  }

  return { openFolderWorkflowsFromUrl }
}
