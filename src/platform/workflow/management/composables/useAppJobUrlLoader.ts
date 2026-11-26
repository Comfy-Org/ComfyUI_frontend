import { useRouter } from 'vue-router'

import {
  extractApiPrompt,
  extractWorkflow
} from '@comfyorg/api-client/fetchJobs'
import { isCloud } from '@/platform/distribution/types'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { importApiPrompt } from '@/platform/workflow/utils/importApiPrompt'
import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'

const jobIdPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

async function localJobPrompt(id: string): Promise<unknown> {
  const response = await api.fetchApi('/history/' + id)
  if (!response.ok) return
  const history = await response.json()
  return history[id]?.prompt?.[2]
}

/** Opens a submitted job using the current editor's authenticated backend. */
export function useAppJobUrlLoader() {
  const router = useRouter()

  const reportFailure = () => useToast().error(t('openOnCloud.handoffFailed'))
  return async () => {
    const namespace = PRESERVED_QUERY_NAMESPACES.APP_JOB
    const routeQuery = router.currentRoute.value.query
    hydratePreservedQuery(namespace)
    const link =
      mergePreservedQueryIntoQuery(namespace, routeQuery) ?? routeQuery
    const { appJob: id, appWorkflowName, appJobWorkspace } = link
    if (id === undefined) return
    const query = { ...routeQuery }
    delete query.appJob
    delete query.appWorkflowName
    delete query.appJobWorkspace
    clearPreservedQuery(namespace)
    try {
      await router.replace({ query })
      if (typeof id !== 'string' || !jobIdPattern.test(id))
        return void reportFailure()
      const workspace = isCloud ? useTeamWorkspaceStore() : null
      const inScope = () =>
        workspace
          ? typeof appJobWorkspace === 'string' &&
            !!appJobWorkspace &&
            workspace.activeWorkspaceId === appJobWorkspace
          : appJobWorkspace === undefined
      if (!inScope()) return void reportFailure()
      const name =
        typeof appWorkflowName === 'string'
          ? appWorkflowName
              .replace(/[^\p{L}\p{N} ._-]/gu, '_')
              .trim()
              .slice(0, 96)
          : ''
      const job = workspace ? await api.getJobDetail(id) : undefined
      if (workspace && job?.id !== id) return void reportFailure()
      const graph = job && (await extractWorkflow(job))
      if (!inScope()) return void reportFailure()
      if (graph) {
        if (
          (await useApp().loadGraphData(graph, true, true, name || id, {
            isCurrent: inScope
          })) === false
        )
          return void reportFailure()
        return
      }
      const data = workspace ? extractApiPrompt(job) : await localJobPrompt(id)
      if (!inScope()) return void reportFailure()
      if (!(await importApiPrompt(data, name || id))) reportFailure()
    } catch {
      reportFailure()
    }
  }
}
