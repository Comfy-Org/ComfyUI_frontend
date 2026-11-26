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
import { createHandoffScopeCheck } from '@/platform/workflow/utils/createHandoffScopeCheck'
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

async function openCloudJob(id: string, name: string, inScope: () => boolean) {
  const job = await api.getJobDetail(id)
  if (job?.id !== id) return false
  const graph = await extractWorkflow(job)
  if (!inScope()) return false
  if (!graph) return importApiPrompt(extractApiPrompt(job), name)
  return (
    (await useApp().loadGraphData(graph, true, true, name, {
      isCurrent: inScope
    })) !== false
  )
}

async function openJob(id: string, name: string, inScope: () => boolean) {
  if (!inScope()) return false
  if (isCloud) return openCloudJob(id, name, inScope)
  const data = await localJobPrompt(id)
  return inScope() && (await importApiPrompt(data, name))
}

function workflowName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  return (
    value
      .replace(/[^\p{L}\p{N} ._-]/gu, '_')
      .trim()
      .slice(0, 96) || fallback
  )
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
      if (
        !(await openJob(
          id,
          workflowName(appWorkflowName, id),
          createHandoffScopeCheck(appJobWorkspace)
        ))
      )
        reportFailure()
    } catch {
      reportFailure()
    }
  }
}
