import type {
  CreateRequest,
  PackSourceRequest,
  RequestStatus
} from '@comfyorg/magic-patch-types'
import type { createMagicPatchClient } from '../services/magicPatchClient'

type Client = ReturnType<typeof createMagicPatchClient>
type Intent = { body: CreateRequest; key: string }
export type ConversionState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'retry'; intent: Intent }
  | { phase: 'error' }
  | { phase: 'active'; request: RequestStatus; disconnected: boolean }

export function createMagicPatchConversion(
  client: Pick<Client, 'source' | 'submit' | 'status' | 'cancel'>,
  publish: (state: ConversionState) => void,
  current: () => boolean
) {
  let state: ConversionState = { phase: 'idle' }
  let busy = false
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
  async function start(selector: PackSourceRequest) {
    if (busy || state.phase !== 'idle' || !current()) return
    busy = true
    update({ phase: 'submitting' })
    try {
      const source = await client.source(selector, abort.signal)
      if (!current() || abort.signal.aborted) return
      if (!source.ok) {
        update({ phase: 'error' })
        return
      }
      await send({
        body: {
          source_ref: source.value.source_ref,
          entry_point: source.value.entry_point,
          pin_on_ready: true
        },
        key: crypto.randomUUID()
      })
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
