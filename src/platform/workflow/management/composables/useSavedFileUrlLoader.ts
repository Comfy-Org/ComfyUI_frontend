import { zUserDataResponseFull } from '@comfyorg/ingest-types/zod'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useRoute, useRouter } from 'vue-router'
import { z } from 'zod'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import {
  clearPreservedQuery,
  getPreservedQueryParam,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.SAVED_FILE
const uuid = z.uuid()
const savedFileSchema = zUserDataResponseFull.required().extend({ id: uuid })

type SavedFileLoadStatus = 'absent' | 'pending' | 'opened' | 'failed'
type LookupResult =
  | { kind: 'found'; path: string }
  | { kind: 'not-found' }
  | { kind: 'error' }

function isWorkflowPath(path: string): boolean {
  return (
    path.startsWith('workflows/') &&
    path.endsWith('.json') &&
    !path.includes('\\') &&
    path
      .split('/')
      .every((part) => part !== '' && part !== '.' && part !== '..')
  )
}

async function readLookupResponse(
  response: Response,
  id: string
): Promise<LookupResult> {
  if (response.status === 404) return { kind: 'not-found' }
  if (!response.ok) {
    reportError(new Error('Saved workflow lookup failed'), {
      surface: 'graph',
      errorType: 'error_loading_saved_file_link',
      context: { status: response.status }
    })
    return { kind: 'error' }
  }
  const body: unknown = await response.json()
  const parsed = savedFileSchema.safeParse(body)
  if (!parsed.success || parsed.data.id.toLowerCase() !== id.toLowerCase()) {
    reportError(new Error('Invalid saved workflow lookup response'), {
      surface: 'graph',
      errorType: 'error_loading_saved_file_link'
    })
    return { kind: 'error' }
  }
  return isWorkflowPath(parsed.data.path)
    ? { kind: 'found', path: parsed.data.path }
    : { kind: 'not-found' }
}

async function lookupSavedFile(id: string): Promise<LookupResult> {
  try {
    const response = await api.fetchApi(`/userdata-files/${id}`)
    return await readLookupResponse(response, id)
  } catch {
    reportError(new Error('Could not read saved workflow link'), {
      surface: 'graph',
      errorType: 'error_loading_saved_file_link'
    })
    return { kind: 'error' }
  }
}

function navigationPending(query: Record<string, unknown>): boolean {
  return [
    PRESERVED_QUERY_NAMESPACES.WORKSPACE,
    PRESERVED_QUERY_NAMESPACES.DEPLOYMENT
  ].some(
    (namespace) =>
      namespace in query ||
      getPreservedQueryParam(namespace, namespace) !== undefined
  )
}

type OpenOutcome = 'opened' | 'not_found' | 'error' | 'pending'

export function useSavedFileUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const workflowStore = useWorkflowStore()
  const workspaceStore = useTeamWorkspaceStore()
  const toast = useToast()

  async function clearIntent() {
    hydratePreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOWS)
    const query = { ...route.query }
    delete query.savedFile
    delete query.workflows
    try {
      await router.replace({ query })
    } catch {
      reportError(new Error('Could not clear saved workflow link'), {
        surface: 'graph',
        errorType: 'error_clearing_saved_file_link'
      })
    }
    clearPreservedQuery(NAMESPACE)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOWS)
  }

  async function openPath(
    path: string,
    isCurrent: () => boolean
  ): Promise<OpenOutcome> {
    try {
      await workflowStore.loadWorkflows()
      if (!isCurrent()) return 'pending'
      const workflow = workflowStore.getWorkflowByPath(path)
      if (!workflow) return 'error'
      const opened = await useWorkflowService().openWorkflow(workflow, {
        isCurrent
      })
      return opened ? 'opened' : 'error'
    } catch {
      reportError(new Error('Could not open saved workflow link'), {
        surface: 'graph',
        errorType: 'error_opening_saved_file_link'
      })
      return 'error'
    }
  }

  async function resolveLink(
    value: unknown,
    isCurrent: () => boolean
  ): Promise<OpenOutcome> {
    if (typeof value !== 'string' || !uuid.safeParse(value).success)
      return 'not_found'
    const result = await lookupSavedFile(value)
    if (!isCurrent()) return 'pending'
    if (result.kind === 'found') return openPath(result.path, isCurrent)
    return result.kind === 'not-found' ? 'not_found' : 'error'
  }

  function reportOutcome(
    outcome: Exclude<OpenOutcome, 'pending'>,
    workspaceId: string | null
  ) {
    if (outcome !== 'opened') {
      toast.error(
        t(
          outcome === 'not_found'
            ? 'toastMessages.savedWorkflowNotFound'
            : 'toastMessages.savedWorkflowLoadFailed'
        )
      )
    }
    useTelemetry()?.trackSavedFileLinkOpened({
      outcome,
      workspace_id: workspaceId
    })
  }

  function linkQuery() {
    hydratePreservedQuery(NAMESPACE)
    return 'savedFile' in route.query
      ? route.query
      : (mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query)
  }

  async function openSavedFileFromUrl(
    afterNavigation = false
  ): Promise<SavedFileLoadStatus> {
    if (!isCloud) return 'absent'
    const query = linkQuery()
    if (!('savedFile' in query)) return 'absent'
    if (!afterNavigation && navigationPending(query)) return 'pending'

    const workspaceId = workspaceStore.activeWorkspaceId
    const isCurrent = () => workspaceStore.activeWorkspaceId === workspaceId
    const outcome = await resolveLink(query.savedFile, isCurrent)
    if (outcome === 'pending' || !isCurrent()) return 'pending'
    await clearIntent()
    reportOutcome(outcome, workspaceId)
    return outcome === 'opened' ? 'opened' : 'failed'
  }

  return { openSavedFileFromUrl }
}
