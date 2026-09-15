/**
 * The shared vocabulary for talking about CRDT merges and sequencing.
 *
 * A tester who sees a surprising outcome needs three answers, in this order:
 * WHICH CELL was contested, WHICH ORDER the contenders sorted in, and WHY the
 * loser lost. The pinned applier already names all three — `writeTarget` is
 * the cell, `stampKey` is the order, `ApplyOutcome` is the verdict — so this
 * module deliberately re-exports that language rather than inventing a
 * parallel one. Anything the panel renders is a rewording of a fact the
 * document itself would report.
 *
 * Nothing here reads or writes a shared document: these are pure functions
 * over ops and over a read-only snapshot the caller supplies.
 */
import {
  stampKey,
  stampTargetKey,
  writeTarget
} from '@comfyorg/comfy-multi-player'
import type { NodeId, StampKey, WireOp } from '@comfyorg/comfy-multi-player'

/**
 * Why an op ended up with the outcome it did.
 *
 * The `because` arm on `no-op` is the one that matters to a tester: the
 * applier reports a bare `no-op` for two completely different situations — a
 * resend it has already seen, and a write to a node someone else deleted —
 * and conflating them is exactly the confusion this instrument exists to end.
 */
export type MergeVerdict =
  | { kind: 'applied' }
  | { kind: 'no-op'; because: 'duplicate-op-id' | 'delete-wins' | 'unknown' }
  | { kind: 'lww-dropped'; incumbent: StampKey | null }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'not-reached'; code: string }

/** One op, placed in the merge story: what it contested and how it fared. */
export interface MergeTraceEntry {
  index: number
  opId: string
  kind: string
  actor: string
  /** The LWW cell this op competes for (`writeTarget`, stably serialized). */
  register: string
  /** Human-readable form of the same cell. */
  registerLabel: string
  /** `[base_version, actor, op_id]` — the total order the applier sorts by. */
  stamp: StampKey
  /** The node this op addresses, when it addresses one. */
  nodeId: string | null
  verdict: MergeVerdict
  /** One sentence a product tester can read without knowing Yjs. */
  explanation: string
}

/**
 * The glossary the panel renders next to the trace, so a bug report and the
 * code use the same words for the same thing.
 */
export const MERGE_VOCABULARY: readonly {
  term: string
  meaning: string
}[] = [
  {
    term: 'register',
    meaning:
      'The single cell two edits can contest — e.g. one widget on one node, or one input slot. Edits to different registers never conflict.'
  },
  {
    term: 'stamp',
    meaning:
      'The total order edits are compared in: [base_version, actor, op_id]. Higher wins; the op_id breaks exact ties so every replica picks the same winner offline.'
  },
  {
    term: 'applied',
    meaning: 'The edit took effect and now owns its register.'
  },
  {
    term: 'lww-dropped',
    meaning:
      'The edit reached the document but an edit with a higher stamp already owned the register, so it was discarded. Last-writer-wins.'
  },
  {
    term: 'no-op (delete-wins)',
    meaning:
      'The edit targeted a node that was already deleted. Deletion is not a register contest: once a node is gone, writes to it vanish silently until something re-adds it.'
  },
  {
    term: 'no-op (duplicate)',
    meaning:
      'The document had already applied this op_id. Retries are idempotent by design, so a resend changes nothing.'
  },
  {
    term: 'rejected',
    meaning:
      'The document refused the edit (unknown op kind, deferred kind, bad payload). The rest of the batch is abandoned; the prefix before it is kept.'
  },
  {
    term: 'not-reached',
    meaning:
      'An earlier op in the same batch was rejected, so this one was never attempted (abort-remainder).'
  }
]

/** The node an op addresses, or `null` for ops that address the whole graph. */
export function opNodeId(op: WireOp): string | null {
  if (op.op === 'clear' || op.op === 'reset_doc') return null
  const raw = (op as { node_id?: NodeId }).node_id
  if (raw !== undefined) return String(raw)
  const target = (op as { to_node?: NodeId }).to_node
  return target === undefined ? null : String(target)
}

/**
 * A human label for the contested cell.
 *
 * `writeTarget` returns the applier's own tuple (e.g. `['widget', '7',
 * 'seed']`); rendering it verbatim is honest but unreadable, so each shape
 * gets a sentence and anything unrecognised falls back to the raw tuple
 * rather than being hidden.
 */
export function registerLabel(target: readonly unknown[]): string {
  const [kind, ...rest] = target.map((part) => String(part))
  switch (kind) {
    case 'widget':
      return `widget "${rest[1]}" on node ${rest[0]}`
    case 'input':
      return `input slot ${rest[1]} on node ${rest[0]}`
    case 'node':
      return `node ${rest[0]}`
    case 'clear':
      return 'the whole graph'
    default:
      return target.map((part) => String(part)).join(' · ')
  }
}

function formatStampKey(key: StampKey): string {
  const [baseVersion, actor, opId] = key
  return `v${baseVersion} · ${actor} · ${opId.slice(0, 8)}`
}

function explainVerdict(
  op: WireOp,
  label: string,
  verdict: MergeVerdict
): string {
  switch (verdict.kind) {
    case 'applied':
      return `Applied. \`${op.op}\` now owns ${label}.`
    case 'no-op':
      if (verdict.because === 'delete-wins') {
        return `No effect: node ${opNodeId(op) ?? '?'} had already been deleted, so this write had nowhere to land. Deletion is not a stamp contest — it wins over every write that arrives after it, whatever the stamps say. A later add_node re-creates the node as a fresh incarnation and does NOT resurrect this value.`
      }
      if (verdict.because === 'duplicate-op-id') {
        return `No effect: op_id ${op.op_id.slice(0, 8)} had already been applied. Resends are idempotent, which is why the sender never re-mints an op_id.`
      }
      return 'No effect. The document had nothing to change for this op.'
    case 'lww-dropped':
      return verdict.incumbent
        ? `Dropped: ${label} was already owned by a higher stamp (${formatStampKey(verdict.incumbent)}) than this op's (${formatStampKey(stampKey(op))}). Last-writer-wins picked the incumbent.`
        : `Dropped: a higher stamp already owned ${label}. Last-writer-wins picked the incumbent.`
    case 'rejected':
      return `Rejected (${verdict.code}): ${verdict.message}. Everything after it in the same batch was abandoned; everything before it was kept.`
    case 'not-reached':
      return 'Never attempted: an earlier op in the same batch was rejected, and a batch abandons everything after the failure. The ops before it are kept, so resending the batch without the bad op converges.'
  }
}

export function traceEntry(
  op: WireOp,
  index: number,
  verdict: MergeVerdict
): MergeTraceEntry {
  const target = writeTarget(op)
  const widgetWrite = op as {
    op: string
    node_id?: NodeId
    widget?: unknown
  }
  const label = registerLabel(
    widgetWrite.op === 'set_widget' &&
      widgetWrite.node_id !== undefined &&
      typeof widgetWrite.widget === 'string'
      ? ['widget', widgetWrite.node_id, widgetWrite.widget]
      : target
  )
  return {
    index,
    opId: op.op_id,
    kind: op.op,
    actor: op.actor,
    register: stampTargetKey(op),
    registerLabel: label,
    stamp: stampKey(op),
    nodeId: opNodeId(op),
    verdict,
    explanation: explainVerdict(op, label, verdict)
  }
}

/**
 * Group a trace by the register each op contested — the view that answers
 * "why did these two edits fight?" at a glance.
 */
export function groupByRegister(
  entries: readonly MergeTraceEntry[]
): { register: string; label: string; entries: MergeTraceEntry[] }[] {
  const groups = new Map<
    string,
    { label: string; entries: MergeTraceEntry[] }
  >()
  for (const entry of entries) {
    const group = groups.get(entry.register) ?? {
      label: entry.registerLabel,
      entries: []
    }
    group.entries.push(entry)
    groups.set(entry.register, group)
  }
  return [...groups]
    .map(([register, group]) => ({ register, ...group }))
    .sort((a, b) => b.entries.length - a.entries.length)
}

/**
 * The per-node story: every op that touched a node, in arrival order, with
 * the incarnation it belonged to.
 *
 * Incarnation is the concept the delete/re-add case turns on — a node that is
 * deleted and re-added under the same id is NOT the same node, and every
 * widget value from the previous incarnation is gone. Numbering them makes
 * that visible instead of leaving a tester to infer it.
 */
export interface NodeLifecycleRow {
  nodeId: string
  incarnation: number
  entry: MergeTraceEntry
}

export function nodeLifecycle(
  entries: readonly MergeTraceEntry[]
): NodeLifecycleRow[] {
  const incarnations = new Map<string, number>()
  const rows: NodeLifecycleRow[] = []
  for (const entry of entries) {
    if (entry.nodeId === null) continue
    const current = incarnations.get(entry.nodeId) ?? 1
    if (entry.kind === 'add_node' && entry.verdict.kind === 'applied') {
      const next = incarnations.has(entry.nodeId) ? current + 1 : 1
      incarnations.set(entry.nodeId, next)
      rows.push({ nodeId: entry.nodeId, incarnation: next, entry })
      continue
    }
    // Only an op that took effect may seed the map. A write that no-op'd
    // against a not-yet-existing node would otherwise register the id, and
    // the add that follows it would be labelled the SECOND incarnation.
    if (entry.verdict.kind === 'applied') {
      incarnations.set(entry.nodeId, current)
    }
    rows.push({ nodeId: entry.nodeId, incarnation: current, entry })
  }
  return rows
}
