type ServerFrameType =
  | 'doc_update'
  | 'doc_subscribed'
  | 'doc_ops_result'
  | 'doc_reset'
  | 'awareness'

function serverFrame<T extends ServerFrameType>(
  type: T,
  data: Record<string, unknown>
) {
  return {
    type,
    data: { v: 1, workflow_id: 'wf-1', ...data }
  }
}

export function docUpdateFrame(data: Record<string, unknown> = {}) {
  return serverFrame('doc_update', { seq: 1, update_b64: 'AQ==', ...data })
}

export function docSubscribedFrame(data: Record<string, unknown> = {}) {
  return serverFrame('doc_subscribed', { ok: true, seq: 1, ...data })
}

export function docOpsResultFrame(data: Record<string, unknown> = {}) {
  return serverFrame('doc_ops_result', { ok: true, ...data })
}

export function docResetFrame(data: Record<string, unknown> = {}) {
  return serverFrame('doc_reset', { seq: 1, actor: 'system:mint', ...data })
}

export function awarenessFrame(data: Record<string, unknown> = {}) {
  return serverFrame('awareness', {
    actor: 'human:user:tab-a',
    state: {},
    expires_at: 123,
    ...data
  })
}
