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
const sidebarFileSchema = z.object({
  path: z.string(),
  size: z.number(),
  modified: z.number()
})
const outOfSyncReasonSchema = z.enum([
  'no_sidebar_path',
  'name_ambiguous',
  'file_missing',
  'content_mismatch'
])
const outOfSyncBodySchema = z.object({
  code: z.literal('WORKFLOW_OUT_OF_SYNC'),
  details: z.object({ reason: z.unknown() })
})

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
  if (!parsed.success) return 'unknown'
  const reason = outOfSyncReasonSchema.safeParse(parsed.data.details.reason)
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
  const parsed = sidebarFileSchema.safeParse(body)
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
    reportError(new Error('Could not read workflow link', { cause }), {
      surface: 'graph',
      errorType: 'error_loading_workflow_link'
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
      reportError(new Error('Could not clear workflow link', { cause }), {
        surface: 'graph',
        errorType: 'error_clearing_workflow_link'
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
      reportError(new Error('Could not open workflow link', { cause }), {
        surface: 'graph',
        errorType: 'error_opening_workflow_link'
      })
      return { kind: 'error' }
    }
  }

  async function resolveLink(
    value: unknown,
    isCurrent: () => boolean
  ): Promise<ResolveOutcome> {
    if (typeof value !== 'string' || !workflowIdSchema.safeParse(value).success)
      return { kind: 'not_found' }
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

  function keepsCapturedLink(captured: LinkCarriers): boolean {
    const current = linkCarriers()
    return (
      (current.route === undefined || current.route === captured.route) &&
      (current.stash === undefined || current.stash === captured.stash)
    )
  }

  function hasLink(): boolean {
    const current = linkCarriers()
    return current.route !== undefined || current.stash !== undefined
  }

  function attemptOwnership(workspaceId: string | null): Ownership {
    const captured = linkCarriers()
    const unreplaced = () =>
      !disposed &&
      workspaceStore.activeWorkspaceId === workspaceId &&
      keepsCapturedLink(captured)
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
    const ownership = attemptOwnership(workspaceId)
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
