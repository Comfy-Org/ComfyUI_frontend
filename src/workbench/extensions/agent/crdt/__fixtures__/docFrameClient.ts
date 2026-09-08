type ServerFrameType =
  | 'doc_update'
  | 'doc_subscribed'
  | 'doc_ops_result'
  | 'doc_reset'
  | 'awareness'

interface CommonWireData {
  v?: unknown
  workflow_id?: unknown
}

interface DocUpdateWireData extends CommonWireData {
  seq?: unknown
  lineage_seq?: unknown
  update_b64?: unknown
  actor?: unknown
  op_ids?: unknown
}

interface DocSubscribedWireData extends CommonWireData {
  ok?: unknown
  seq?: unknown
  lineage_seq?: unknown
  code?: unknown
  message?: unknown
}

interface DocOpsResultWireData extends DocSubscribedWireData {
  applied?: unknown
  skipped?: unknown
  failed?: unknown
}

interface DocResetWireData extends CommonWireData {
  seq?: unknown
  lineage_seq?: unknown
  actor?: unknown
}

interface AwarenessWireData extends CommonWireData {
  actor?: unknown
  state?: unknown
  expires_at?: unknown
}

function serverFrame<T extends ServerFrameType>(type: T, data: CommonWireData) {
  return {
    type,
    data: { v: 1, workflow_id: 'wf-1', ...data }
  }
}

export function docUpdateFrame(data: DocUpdateWireData = {}) {
  return serverFrame('doc_update', {
    seq: 1,
    lineage_seq: 1,
    update_b64: 'AQ==',
    ...data
  })
}

export function docSubscribedFrame(data: DocSubscribedWireData = {}) {
  return serverFrame('doc_subscribed', { ok: true, seq: 1, ...data })
}

export function docOpsResultFrame(data: DocOpsResultWireData = {}) {
  return serverFrame('doc_ops_result', { ok: true, ...data })
}

export function docResetFrame(data: DocResetWireData = {}) {
  return serverFrame('doc_reset', {
    seq: 1,
    lineage_seq: 1,
    actor: 'system:mint',
    ...data
  })
}

export function awarenessFrame(data: AwarenessWireData = {}) {
  return serverFrame('awareness', {
    actor: 'human:user:tab-a',
    state: {},
    expires_at: 123,
    ...data
  })
}
