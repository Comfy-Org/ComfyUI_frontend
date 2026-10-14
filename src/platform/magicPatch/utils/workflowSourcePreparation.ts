import type {
  OriginalSource,
  SourceAcquisition
} from '@comfyorg/magic-patch-types'
import { reportError } from '@/platform/telemetry/reportError'
import type {
  MagicPatchFailure,
  createMagicPatchClient
} from '../services/magicPatchClient'
import type { UnresolvedWorkflowPack } from './unresolvedWorkflowPacks'

export type WorkflowSourceState =
  | { phase: 'resolving' }
  | {
      phase: 'preparing'
      acquisition: SourceAcquisition
      deadline: number
      disconnected: boolean
      reason?: string
      failure?: MagicPatchFailure
    }
  | { phase: 'error'; reason: string; failure?: MagicPatchFailure }
  | { phase: 'resolved' }

function failureReason(failure: MagicPatchFailure): string {
  if (failure.status === 401) return 'source_authentication_required'
  if (failure.status === 403) return 'source_access_denied'
  if (failure.status === 429) return 'source_rate_limited'
  if (failure.status !== undefined && failure.status >= 500)
    return 'source_service_unavailable'
  switch (failure.code) {
    case 'scope_changed':
      return 'source_scope_changed'
    case 'unavailable':
      return 'source_service_unavailable'
    case 'response_timeout':
      return 'source_response_timeout'
    case 'transport_indeterminate':
      return 'source_connection_failed'
    case 'invalid_response':
    case 'report_mismatch':
    case 'response_too_large':
    case 'response_too_fragmented':
      return 'source_response_invalid'
    case 'invalid_request':
      return 'source_request_invalid'
    case 'request_failed':
      return failure.reason ?? 'source_request_failed'
  }
}

export function createWorkflowSourcePreparation(
  client: Pick<
    ReturnType<typeof createMagicPatchClient>,
    'prepareWorkflowSource' | 'sourceStatus'
  >,
  current: () => boolean,
  publish: (state: WorkflowSourceState) => void,
  ready: (source: OriginalSource, sourceRef: string) => Promise<boolean>
) {
  const abort = new AbortController()
  let state: WorkflowSourceState = { phase: 'resolving' }
  let busy = false
  let pack: UnresolvedWorkflowPack

  function update(next: WorkflowSourceState) {
    if (!current() || abort.signal.aborted) return
    state = next
    publish(next)
  }

  async function accept(acquisition: SourceAcquisition, deadline: number) {
    if (!current() || abort.signal.aborted) return
    if (acquisition.state === 'queued' || acquisition.state === 'acquiring') {
      update({ phase: 'preparing', acquisition, deadline, disconnected: false })
      return
    }
    if (acquisition.state !== 'ready') {
      update({
        phase: 'error',
        reason: acquisition.reason ?? 'source_lookup_failed'
      })
      return
    }
    const source = acquisition.source
    if (
      !source ||
      !acquisition.source_ref ||
      !acquisition.conversion_supported ||
      !pack.nodeTypes.every((type) => source.nodes.includes(type))
    ) {
      update({ phase: 'error', reason: 'source_binding_invalid' })
      return
    }
    update(
      (await ready(source, acquisition.source_ref))
        ? { phase: 'resolved' }
        : { phase: 'error', reason: 'source_binding_invalid' }
    )
  }

  async function start(selected: UnresolvedWorkflowPack) {
    if (
      busy ||
      state.phase !== 'resolving' ||
      !current() ||
      abort.signal.aborted
    )
      return
    pack = selected
    if (!pack.version) {
      update({ phase: 'error', reason: 'workflow_version_required' })
      return
    }
    if (!pack.cnrId && !pack.auxId) {
      update({ phase: 'error', reason: 'workflow_source_identity_required' })
      return
    }
    busy = true
    try {
      const result = await client.prepareWorkflowSource(
        {
          ...(pack.cnrId ? { cnr_id: pack.cnrId } : {}),
          ...(pack.auxId ? { aux_id: pack.auxId } : {}),
          ver: pack.version,
          node_types: pack.nodeTypes
        },
        abort.signal
      )
      if (result.ok) await accept(result.value, performance.now() + 600_000)
      else
        update({
          phase: 'error',
          reason: failureReason(result.error),
          failure: result.error
        })
    } catch {
      if (current() && !abort.signal.aborted) {
        update({ phase: 'error', reason: 'source_lookup_failed' })
        reportError(new Error('Source preparation failed unexpectedly'), {
          errorType: 'magic_patch_source_preparation_failure'
        })
      }
    } finally {
      busy = false
    }
  }

  async function refresh() {
    if (
      busy ||
      state.phase !== 'preparing' ||
      !current() ||
      abort.signal.aborted
    )
      return
    const previous = state
    if (performance.now() >= previous.deadline) {
      update({ phase: 'error', reason: 'source_preparation_timeout' })
      return
    }
    busy = true
    try {
      const result = await client.sourceStatus(
        previous.acquisition.acquisition_id,
        abort.signal
      )
      if (!result.ok)
        update({
          ...previous,
          disconnected: true,
          reason: failureReason(result.error),
          failure: result.error
        })
      else if (
        result.value.acquisition_id === previous.acquisition.acquisition_id &&
        result.value.status_version >= previous.acquisition.status_version
      )
        await accept(result.value, previous.deadline)
    } catch {
      if (current() && !abort.signal.aborted) {
        update({ phase: 'error', reason: 'source_lookup_failed' })
        reportError(new Error('Source preparation failed unexpectedly'), {
          errorType: 'magic_patch_source_preparation_failure'
        })
      }
    } finally {
      busy = false
    }
  }

  return { start, refresh, dispose: () => abort.abort() }
}
