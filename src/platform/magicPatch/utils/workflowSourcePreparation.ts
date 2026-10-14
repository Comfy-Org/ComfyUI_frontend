import type {
  OriginalSource,
  SourceAcquisition
} from '@comfyorg/magic-patch-types'
import { reportError } from '@/platform/telemetry/reportError'
import type { createMagicPatchClient } from '../services/magicPatchClient'
import type { UnresolvedWorkflowPack } from './unresolvedWorkflowPacks'

export type WorkflowSourceState =
  | { phase: 'resolving' }
  | {
      phase: 'preparing'
      acquisition: SourceAcquisition
      deadline: number
      disconnected: boolean
    }
  | { phase: 'error'; reason: string }
  | { phase: 'resolved' }

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
          reason: result.error.reason ?? 'source_lookup_failed'
        })
    } catch (cause) {
      if (current() && !abort.signal.aborted) {
        update({ phase: 'error', reason: 'source_lookup_failed' })
        reportError(cause, {
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
      if (!result.ok) update({ ...previous, disconnected: true })
      else if (
        result.value.acquisition_id === previous.acquisition.acquisition_id &&
        result.value.status_version >= previous.acquisition.status_version
      )
        await accept(result.value, previous.deadline)
    } catch (cause) {
      if (current() && !abort.signal.aborted) {
        update({ phase: 'error', reason: 'source_lookup_failed' })
        reportError(cause, {
          errorType: 'magic_patch_source_preparation_failure'
        })
      }
    } finally {
      busy = false
    }
  }

  return { start, refresh, dispose: () => abort.abort() }
}
