import {
  zErrorResponse,
  zWorkflowSidebarFileResponse
} from '@comfyorg/ingest-types/zod'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import type {
  WorkflowLinkOpenedMetadata,
  WorkflowLinkOutOfSyncReason
} from '@comfyorg/telemetry/types'
import { createSharedComposable } from '@vueuse/core'
import { onScopeDispose } from 'vue'
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

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID
const workflowIdSchema = z.uuid()
const outOfSyncReasonSchema = z.enum([
  'no_sidebar_path',
  'name_ambiguous',
  'file_missing',
  'content_mismatch'
])
const outOfSyncBodySchema = zErrorResponse.pick({ code: true, details: true })

type WorkflowLinkLoadStatus = 'absent' | 'pending' | 'opened' | 'failed'
type LinkOutcome =
  | { kind: 'opened' }
  | { kind: 'not_found' }
  | { kind: 'out_of_sync'; reason: WorkflowLinkOutOfSyncReason }
  | { kind: 'error' }
type ResolveOutcome = LinkOutcome | { kind: 'pending' }
type LookupResult =
  | { kind: 'found'; path: string }
  | Exclude<LinkOutcome, { kind: 'opened' }>
type LinkCarriers = { route: unknown; stash: string | undefined }
type Ownership = {
  owns: () => boolean
  unreplaced: () => boolean
}

function isWorkflowId(value: unknown): value is string {
  return typeof value === 'string' && workflowIdSchema.safeParse(value).success
}

function linkIdentity(value: unknown): unknown {
  if (value === null) return ','
  if (!Array.isArray(value)) return value
  if (value.length === 1) return linkIdentity(value[0])
  return value.map((entry: unknown) => entry ?? '').join(',')
}

function isSameLink(carried: unknown, workflowId: unknown): boolean {
  return linkIdentity(carried) === linkIdentity(workflowId)
}

const BUILT_IN_ERROR_NAMES: ReadonlySet<string> = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'EvalError',
  'URIError',
  'AggregateError'
])

function failureContext(cause: unknown) {
  if (!(cause instanceof Error)) return { error_name: typeof cause }
  const name = cause.name
  return { error_name: BUILT_IN_ERROR_NAMES.has(name) ? name : 'other' }
}

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

async function readOutOfSyncReason(
  response: Response
): Promise<WorkflowLinkOutOfSyncReason> {
  const body: unknown = await response.json().catch(() => undefined)
  const parsed = outOfSyncBodySchema.safeParse(body)
  if (!parsed.success || parsed.data.code !== 'WORKFLOW_OUT_OF_SYNC')
    return 'unknown'
  const reason = outOfSyncReasonSchema.safeParse(parsed.data.details?.reason)
  return reason.success ? reason.data : 'unknown'
}

async function readLookupResponse(response: Response): Promise<LookupResult> {
  if (response.status === 404) return { kind: 'not_found' }
  if (response.status === 409)
    return { kind: 'out_of_sync', reason: await readOutOfSyncReason(response) }
  if (!response.ok) {
    reportError(new Error('Workflow link lookup failed'), {
      surface: 'graph',
      errorType: 'error_loading_workflow_link',
      context: { status: response.status }
    })
    return { kind: 'error' }
  }
  const body: unknown = await response.json()
  const parsed = zWorkflowSidebarFileResponse.safeParse(body)
  if (!parsed.success || !isWorkflowPath(parsed.data.path)) {
    reportError(new Error('Invalid workflow link lookup response'), {
      surface: 'graph',
      errorType: 'error_loading_workflow_link'
    })
    return { kind: 'error' }
  }
  return { kind: 'found', path: parsed.data.path }
}

async function lookupSidebarFile(workflowId: string): Promise<LookupResult> {
  try {
    const response = await api.fetchApi(`/workflows/${workflowId}/sidebar-file`)
    return await readLookupResponse(response)
  } catch (cause) {
    reportError(new Error('Could not read workflow link'), {
      surface: 'graph',
      errorType: 'error_loading_workflow_link',
      context: failureContext(cause)
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

function toTelemetry(
  outcome: LinkOutcome,
  workspaceId: string | null
): WorkflowLinkOpenedMetadata {
  return outcome.kind === 'out_of_sync'
    ? {
        outcome: 'out_of_sync',
        reason: outcome.reason,
        workspace_id: workspaceId
      }
    : { outcome: outcome.kind, workspace_id: workspaceId }
}

function useWorkflowLinkUrlLoaderInternal() {
  const route = useRoute()
  const router = useRouter()
  const workflowStore = useWorkflowStore()
  const workspaceStore = useTeamWorkspaceStore()
  const toast = useToast()
  let completed:
    | {
        value: unknown
        workspaceId: string | null
        status: 'opened' | 'failed'
      }
    | undefined
  const startedLinks = new Set<unknown>()
  let disposed = false
  onScopeDispose(() => {
    disposed = true
  })

  async function stripLinkFromUrl(): Promise<boolean> {
    if (!('workflowId' in route.query) && !('workflows' in route.query))
      return true
    const query = { ...route.query }
    delete query.workflowId
    delete query.workflows
    try {
      return (await router.replace({ query })) === undefined
    } catch (cause) {
      reportError(new Error('Could not clear workflow link'), {
        surface: 'graph',
        errorType: 'error_clearing_workflow_link',
        context: failureContext(cause)
      })
      return true
    }
  }

  async function clearOwnedIntent(ownership: Ownership) {
    if (!ownership.owns()) return
    hydratePreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOWS)
    if (!(await stripLinkFromUrl()) || !ownership.unreplaced()) return
    clearPreservedQuery(NAMESPACE)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOWS)
  }

  async function openPath(
    path: string,
    isCurrent: () => boolean
  ): Promise<ResolveOutcome> {
    try {
      await workflowStore.loadWorkflows()
      if (!isCurrent()) return { kind: 'pending' }
      let workflow = workflowStore.getWorkflowByPath(path)
      if (!workflow) {
        await workflowStore.syncWorkflows()
        if (!isCurrent()) return { kind: 'pending' }
        workflow = workflowStore.getWorkflowByPath(path)
      }
      if (!workflow) {
        reportError(
          new Error('Workflow link file is not in the workflow list'),
          {
            surface: 'graph',
            errorType: 'error_opening_workflow_link'
          }
        )
        return { kind: 'error' }
      }
      const opened = await useWorkflowService().openWorkflow(workflow, {
        isCurrent
      })
      return opened ? { kind: 'opened' } : { kind: 'error' }
    } catch (cause) {
      reportError(new Error('Could not open workflow link'), {
        surface: 'graph',
        errorType: 'error_opening_workflow_link',
        context: failureContext(cause)
      })
      return { kind: 'error' }
    }
  }

  async function resolveLink(
    value: unknown,
    isCurrent: () => boolean
  ): Promise<ResolveOutcome> {
    if (!isWorkflowId(value)) return { kind: 'not_found' }
    const result = await lookupSidebarFile(value)
    if (!isCurrent()) return { kind: 'pending' }
    return result.kind === 'found' ? openPath(result.path, isCurrent) : result
  }

  function reportOutcome(outcome: LinkOutcome, workspaceId: string | null) {
    if (outcome.kind !== 'opened') {
      toast.error(
        t(
          outcome.kind === 'error'
            ? 'toastMessages.linkedWorkflowLoadFailed'
            : 'toastMessages.linkedWorkflowNotOpened'
        )
      )
    }
    useTelemetry()?.trackWorkflowLinkOpened(toTelemetry(outcome, workspaceId))
  }

  function linkQuery() {
    hydratePreservedQuery(NAMESPACE)
    return 'workflowId' in route.query
      ? route.query
      : (mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query)
  }

  function linkCarriers(): LinkCarriers {
    return {
      route: route.query.workflowId,
      stash: getPreservedQueryParam(NAMESPACE, 'workflowId')
    }
  }

  function carriesOnly(workflowId: unknown): boolean {
    const { route, stash } = linkCarriers()
    return (
      (route === undefined || isSameLink(route, workflowId)) &&
      (stash === undefined || isSameLink(stash, workflowId))
    )
  }

  function hasLink(): boolean {
    const current = linkCarriers()
    return current.route !== undefined || current.stash !== undefined
  }

  function attemptOwnership(
    workflowId: unknown,
    workspaceId: string | null
  ): Ownership {
    const unreplaced = () =>
      !disposed &&
      workspaceStore.activeWorkspaceId === workspaceId &&
      carriesOnly(workflowId)
    return { owns: () => hasLink() && unreplaced(), unreplaced }
  }

  function completedStatus(value: unknown, workspaceId: string | null) {
    if (
      !completed ||
      completed.value !== value ||
      completed.workspaceId !== workspaceId
    )
      return undefined
    return completed.status
  }

  async function openWorkflowLinkFromUrl(
    afterNavigation = false
  ): Promise<WorkflowLinkLoadStatus> {
    if (!isCloud) return 'absent'
    const query = linkQuery()
    if (!('workflowId' in query)) return 'absent'
    if (!afterNavigation && navigationPending(query)) return 'pending'
    return settleLink(query.workflowId, workspaceStore.activeWorkspaceId)
  }

  async function settleLink(
    workflowId: unknown,
    workspaceId: string | null
  ): Promise<WorkflowLinkLoadStatus> {
    startedLinks.add(workflowId)
    const ownership = attemptOwnership(workflowId, workspaceId)
    const priorStatus = completedStatus(workflowId, workspaceId)
    if (priorStatus) {
      await clearOwnedIntent(ownership)
      return priorStatus
    }
    const outcome = await resolveLink(workflowId, ownership.owns)
    if (outcome.kind === 'pending' || !ownership.owns()) return 'pending'
    const status = outcome.kind === 'opened' ? 'opened' : 'failed'
    completed = { value: workflowId, workspaceId, status }
    await clearOwnedIntent(ownership)
    reportOutcome(outcome, workspaceId)
    return status
  }

  function isLinkSettled(workflowId: unknown): boolean {
    return (
      completedStatus(workflowId, workspaceStore.activeWorkspaceId) !==
      undefined
    )
  }

  function hasLinkInFlight(): boolean {
    const { route, stash } = linkCarriers()
    return stash !== undefined && stash !== route && !startedLinks.has(stash)
  }

  return { openWorkflowLinkFromUrl, isLinkSettled, hasLinkInFlight }
}

export const useWorkflowLinkUrlLoader = createSharedComposable(
  useWorkflowLinkUrlLoaderInternal
)
