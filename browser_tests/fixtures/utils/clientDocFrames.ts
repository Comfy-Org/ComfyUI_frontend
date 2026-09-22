/**
 * The follower→host boundary for fixture doc hosts: raw `/ws` text in, a
 * typed client frame out. The applier is the only judge of an op's SEMANTICS
 * (whether it converges, wins a register, or is rejected), but its structure
 * is external data to a fixture host, so it is validated here rather than
 * cast — a drifted or malformed op should name itself at the socket, not fail
 * deep inside `applyOps` or land in a captured-op list unchecked.
 */
import type { Op } from '@comfyorg/comfy-multi-player'

export type ClientDocFrame =
  | { type: 'doc_subscribe'; workflowId: string; stateVectorB64: string }
  | { type: 'doc_ops'; workflowId: string; ops: Op[] }

/** uuid4 hex, as `opEnvelope.ts` mints it (vocabulary §8.2). */
const OP_ID_PATTERN = /^[0-9a-f]{32}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `NodeId` is deliberately `string | number` (vocabulary §8.1). */
function isNodeId(value: unknown): boolean {
  return (
    (typeof value === 'string' && value.length > 0) ||
    (typeof value === 'number' && Number.isFinite(value))
  )
}

function isNodeIdArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isNodeId)
}

function isNumberArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => Number.isFinite(entry))
}

function hasWireIdentity(op: Record<string, unknown>): boolean {
  const { op_id, actor, base_version, stamp } = op
  return (
    typeof op_id === 'string' &&
    OP_ID_PATTERN.test(op_id) &&
    typeof actor === 'string' &&
    actor.length > 0 &&
    Number.isInteger(base_version) &&
    Array.isArray(stamp) &&
    stamp.length === 2 &&
    Number.isInteger(stamp[0]) &&
    typeof stamp[1] === 'string'
  )
}

/** The required payload of each kind `applyOps` implements (`FROZEN_OPS`). */
function hasPayloadForKind(op: Record<string, unknown>): boolean {
  switch (op.op) {
    case 'add_node':
      return (
        isNodeId(op.node_id) &&
        typeof op.class_type === 'string' &&
        isNumberArray(op.pos) &&
        isRecord(op.node)
      )
    case 'connect':
      return (
        isNodeId(op.link_id) &&
        isNodeId(op.from_node) &&
        Number.isInteger(op.from_slot) &&
        isNodeId(op.to_node) &&
        typeof op.link_type === 'string' &&
        // A concrete input index, or the autogrow payload that appends one.
        (Number.isInteger(op.to_slot) || isRecord(op.grow))
      )
    case 'set_widget':
      return (
        isNodeId(op.node_id) &&
        typeof op.widget === 'string' &&
        Object.hasOwn(op, 'value')
      )
    case 'delete_node':
      return isNodeId(op.node_id) && isNodeIdArray(op.removed_links)
    case 'clear':
      return isNodeIdArray(op.removed_nodes)
    default:
      return false
  }
}

function parseOps(value: unknown): Op[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `doc_ops frame carries no op array: ${JSON.stringify(value)}`
    )
  }
  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      !hasWireIdentity(entry) ||
      !hasPayloadForKind(entry)
    )
      throw new Error(
        `doc_ops frame carries an invalid op: ${JSON.stringify(entry)}`
      )
    return entry as unknown as Op
  })
}

/**
 * Parses one client frame, or returns `null` for anything that is not a doc
 * frame this host answers (the app shares `/ws` with other traffic). A doc
 * frame whose ops are structurally invalid throws instead of being skipped,
 * so harness drift surfaces here rather than as a mystery later.
 */
export function parseClientDocFrame(
  raw: string | Buffer
): ClientDocFrame | null {
  const frame: unknown = JSON.parse(raw.toString())
  if (!isRecord(frame) || !isRecord(frame.data)) return null
  const { workflow_id, state_vector_b64, ops } = frame.data
  if (typeof workflow_id !== 'string' || workflow_id.length === 0) return null

  if (frame.type === 'doc_subscribe') {
    if (typeof state_vector_b64 !== 'string') return null
    return {
      type: 'doc_subscribe',
      workflowId: workflow_id,
      stateVectorB64: state_vector_b64
    }
  }
  if (frame.type === 'doc_ops') {
    return { type: 'doc_ops', workflowId: workflow_id, ops: parseOps(ops) }
  }
  return null
}
