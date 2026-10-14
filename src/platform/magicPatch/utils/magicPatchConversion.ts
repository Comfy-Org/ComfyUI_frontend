import type {
  CreateRequest,
  PackSourceRequest,
  RequestStatus,
  SourceAcquisition
} from '@comfyorg/magic-patch-types'
import type { createMagicPatchClient } from '../services/magicPatchClient'

type Client = ReturnType<typeof createMagicPatchClient>
type Intent = { body: CreateRequest; key: string }
export type ConversionState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'retry'; intent: Intent }
  | { phase: 'error'; reason?: string }
  | {
      phase: 'preparing'
      selector: PackSourceRequest
      acquisition: SourceAcquisition
      deadline: number
      disconnected: boolean
    }
  | { phase: 'active'; request: RequestStatus; disconnected: boolean }

export function createMagicPatchConversion(
  client: Pick<Client, 'source' | 'submit' | 'status' | 'cancel'> &
    Partial<Pick<Client, 'prepareSource' | 'sourceStatus' | 'eligibility'>>,
  publish: (state: ConversionState) => void,
  current: () => boolean
) {
  let state: ConversionState = { phase: 'idle' }
  let busy = false
  let versionHints: readonly { type: string; version: string }[] = []
  const abort = new AbortController()
  const update = (next: ConversionState) => {
    if (!current() || abort.signal.aborted) return
    state = next
    publish(next)
  }
  async function send(intent: Intent) {
    const result = await client.submit(intent.body, intent.key, abort.signal)
    if (result.ok)
      update({ phase: 'active', request: result.value, disconnected: false })
    else update({ phase: 'retry', intent })
  }
  async function mintAndSend(
    selector: PackSourceRequest,
    expectedRef?: string
  ) {
    const source = await client.source(selector, abort.signal)
    if (!current() || abort.signal.aborted) return
    if (!source.ok) {
      if (
        !expectedRef &&
        source.error.reason === 'source_preparation_required' &&
        client.prepareSource
      ) {
        const prepared = await client.prepareSource(selector, abort.signal)
        if (prepared.ok)
          await acceptPreparation(
            selector,
            prepared.value,
            performance.now() + 600_000
          )
        else update({ phase: 'error', reason: prepared.error.reason })
      } else update({ phase: 'error', reason: source.error.reason })
      return
    }
    if (expectedRef && source.value.source_ref !== expectedRef) {
      update({ phase: 'error', reason: 'source_binding_invalid' })
      return
    }
    for (const hint of versionHints) {
      const eligible = await client.eligibility?.(
        selector,
        hint.version,
        hint.type,
        abort.signal
      )
      if (!current() || abort.signal.aborted) return
      if (
        !eligible?.ok ||
        eligible.value.candidates.length !== 1 ||
        eligible.value.candidates[0]?.revision_id !== selector.revision_id
      ) {
        update({
          phase: 'error',
          reason: eligible?.ok
            ? eligible.value.unsupported[0]?.reason
            : undefined
        })
        return
      }
    }
    await send({
      body: {
        source_ref: source.value.source_ref,
        entry_point: source.value.entry_point,
        pin_on_ready: true
      },
      key: crypto.randomUUID()
    })
  }
  async function acceptPreparation(
    selector: PackSourceRequest,
    acquisition: SourceAcquisition,
    deadline: number
  ) {
    if (!current() || abort.signal.aborted) return
    if (acquisition.state === 'ready') {
      const source = acquisition.source
      if (
        !acquisition.conversion_supported ||
        !acquisition.source_ref ||
        !source ||
        source.pack_id !== selector.pack_id ||
        ![source.revision_id, source.registry_revision_id].includes(
          selector.revision_id
        )
      ) {
        update({ phase: 'error', reason: 'source_binding_invalid' })
        return
      }
      update({ phase: 'submitting' })
      await mintAndSend(selector, acquisition.source_ref)
    } else if (['queued', 'acquiring'].includes(acquisition.state)) {
      update({
        phase: 'preparing',
        selector,
        acquisition,
        deadline,
        disconnected: false
      })
    } else
      update({
        phase: 'error',
        reason: acquisition.reason ?? 'source_preparation_unsupported'
      })
  }
  async function start(
    selector: PackSourceRequest,
    hints: readonly { type: string; version: string }[] = [],
    expectedSourceRef?: string
  ) {
    if (busy || state.phase !== 'idle' || !current()) return
    busy = true
    versionHints = [
      ...new Map(
        hints.map((hint) => [JSON.stringify([hint.type, hint.version]), hint])
      ).values()
    ]
    if (versionHints.length > 64) {
      update({ phase: 'error' })
      busy = false
      return
    }
    update({ phase: 'submitting' })
    try {
      await mintAndSend(selector, expectedSourceRef)
    } finally {
      busy = false
    }
  }
  async function retry() {
    if (busy || state.phase !== 'retry' || !current()) return
    const intent = state.intent
    busy = true
    update({ phase: 'submitting' })
    try {
      await send(intent)
    } finally {
      busy = false
    }
  }
  async function refresh() {
    if (!busy && state.phase === 'preparing' && current()) {
      const previous = state
      if (performance.now() >= previous.deadline) {
        update({ phase: 'error', reason: 'source_preparation_timeout' })
        return
      }
      busy = true
      try {
        const result = await client.sourceStatus?.(
          previous.acquisition.acquisition_id,
          abort.signal
        )
        if (!current() || abort.signal.aborted) return
        if (
          !result?.ok ||
          result.value.acquisition_id !== previous.acquisition.acquisition_id
        ) {
          update({ ...previous, disconnected: true })
          return
        }
        if (result.value.status_version < previous.acquisition.status_version)
          return
        await acceptPreparation(
          previous.selector,
          result.value,
          previous.deadline
        )
      } finally {
        busy = false
      }
      return
    }
    if (busy || state.phase !== 'active' || !current()) return
    const previous = state.request
    busy = true
    try {
      const result = await client.status(previous.id, abort.signal)
      if (!current() || abort.signal.aborted) return
      if (!result.ok || result.value.operation_id !== previous.operation_id) {
        update({ phase: 'active', request: previous, disconnected: true })
        return
      }
      if (result.value.status_version < previous.status_version) return
      update({ phase: 'active', request: result.value, disconnected: false })
    } finally {
      busy = false
    }
  }
  async function cancel() {
    if (busy || state.phase !== 'active' || !current()) return
    const previous = state.request
    busy = true
    try {
      const result = await client.cancel(previous.id, abort.signal)
      if (
        !result.ok ||
        result.value.request.operation_id !== previous.operation_id
      ) {
        update({ phase: 'active', request: previous, disconnected: true })
        return
      }
      if (result.value.request.status_version < previous.status_version) return
      update({
        phase: 'active',
        request: result.value.request,
        disconnected: false
      })
    } finally {
      busy = false
    }
  }
  return { start, retry, refresh, cancel, dispose: () => abort.abort() }
}
