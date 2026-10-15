type ServerFrameType = 'doc_update' | 'doc_ops_result' | 'awareness'

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
  code?: unknown
  message?: unknown
}

interface DocOpsResultWireData extends DocSubscribedWireData {
  applied?: unknown
  skipped?: unknown
  failed?: unknown
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
    lineage_seq: 0,
    update_b64: 'AQ==',
    ...data
  })
}

export function docOpsResultFrame(data: DocOpsResultWireData = {}) {
  return serverFrame('doc_ops_result', { ok: true, ...data })
}

export function awarenessFrame(data: AwarenessWireData = {}) {
  return serverFrame('awareness', {
    actor: 'human:user:tab-a',
    state: {},
    expires_at: 123,
    ...data
  })
}
