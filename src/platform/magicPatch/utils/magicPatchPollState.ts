import type { RequestPage, RequestStatus } from '@comfyorg/magic-patch-types'

type Requests = Record<string, RequestStatus>
type ActiveScope = { scope: string; requests: Requests }
export type MagicPatchPollState =
  | { phase: 'disabled' }
  | ({ phase: 'idle' } & ActiveScope)
  | ({
      phase: 'polling'
      scan: string
      batch: Requests
      cursors: string[]
    } & ActiveScope)
  | ({ phase: 'failed' } & ActiveScope)

type MagicPatchPollEvent =
  | { type: 'enabled'; scope: string }
  | { type: 'disabled' }
  | { type: 'scope_changed'; scope: string }
  | { type: 'poll_started'; scope: string; scan: string }
  | { type: 'page_received'; scope: string; scan: string; page: RequestPage }
  | { type: 'poll_failed'; scope: string; scan: string }

export function reduceMagicPatchPoll(
  state: MagicPatchPollState,
  event: MagicPatchPollEvent
): MagicPatchPollState {
  if (event.type === 'disabled') return { phase: 'disabled' }
  if (event.type === 'enabled') {
    return { phase: 'idle', scope: event.scope, requests: {} }
  }
  if (state.phase === 'disabled') return state
  if (event.type === 'scope_changed') {
    return { phase: 'idle', scope: event.scope, requests: {} }
  }
  if (event.scope !== state.scope) return state
  if (event.type === 'poll_started') {
    return {
      phase: 'polling',
      scope: state.scope,
      requests: state.requests,
      scan: event.scan,
      batch: {},
      cursors: []
    }
  }
  if (state.phase !== 'polling' || event.scan !== state.scan) return state
  if (event.type === 'poll_failed') {
    return { phase: 'failed', scope: state.scope, requests: state.requests }
  }
  const cursor = event.page.next_cursor
  if (cursor && state.cursors.includes(cursor)) {
    return { phase: 'failed', scope: state.scope, requests: state.requests }
  }
  const batch = { ...state.batch }
  for (const request of event.page.requests) {
    const previous = batch[request.id] ?? state.requests[request.id]
    if (previous && previous.operation_id !== request.operation_id) {
      return { phase: 'failed', scope: state.scope, requests: state.requests }
    }
    batch[request.id] =
      previous && previous.status_version >= request.status_version
        ? previous
        : request
  }
  if (!cursor) return { phase: 'idle', scope: state.scope, requests: batch }
  return { ...state, batch, cursors: [...state.cursors, cursor] }
}
