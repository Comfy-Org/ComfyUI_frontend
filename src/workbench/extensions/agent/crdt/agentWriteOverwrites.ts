import { isEqual } from 'es-toolkit'

import { onGraphIntent } from '@/lib/litegraph/src/graphIntents'
import type {
  GraphIntentEvent,
  GraphIntentSource
} from '@/lib/litegraph/src/graphIntents'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

import { isLiveAgentTurnWrite } from './agentRemoteProvenance'
import { recordDevEvent } from './devPanelLog'

type OverwritingEditKind = 'canvas-edit' | 'undo-redo-restore' | 'graph-load'

export interface WidgetValueShape {
  type:
    | 'boolean'
    | 'number'
    | 'string'
    | 'array'
    | 'object'
    | 'null'
    | 'undefined'
    | 'other'
  literal?: boolean | number
  length?: number
}

export interface AgentWriteOverwriteWatchDeps {
  isEnabled(): boolean
  isRestoringState(): boolean
}

export interface AgentWriteOverwriteWatch {
  detach(): void
}

const MAX_TRACKED_REGISTERS = 256

/**
 * Per-session ceiling on telemetry reports. One undo or reload can revert a
 * whole Agent frame, so an uncapped watch would send up to
 * `MAX_TRACKED_REGISTERS` reports synchronously from inside the widget
 * setter. The dev-panel ring buffer is local and stays uncapped; what this
 * bounds is the egress.
 */
const MAX_TELEMETRY_REPORTS = 32

export function describeWidgetValue(value: unknown): WidgetValueShape {
  if (value === null) return { type: 'null' }
  switch (typeof value) {
    case 'undefined':
      return { type: 'undefined' }
    case 'boolean':
      return { type: 'boolean', literal: value }
    // A number is kept literally on purpose: the ticket asks for the old and
    // new value, and a seed, duration or dimension is what identifies the
    // overwriting action. Free-form text is the content risk, so a string
    // keeps its length only.
    case 'number':
      return { type: 'number', literal: value }
    case 'string':
      return { type: 'string', length: value.length }
    case 'object':
      return Array.isArray(value)
        ? { type: 'array', length: value.length }
        : { type: 'object', length: Object.keys(value).length }
    default:
      return { type: 'other' }
  }
}

/**
 * Which kind of local edit arrived. A restore is named from the change
 * tracker rather than from the intent source: `local` is the default source
 * for any write outside a `withGraphIntentSource` scope, so an
 * `afterConfigureGraph` hook or a normalization watcher running during a
 * restore would otherwise read as a person's canvas edit.
 */
function editKindOf(
  source: Exclude<GraphIntentSource, 'agent-remote'>,
  isRestoringState: boolean
): OverwritingEditKind {
  if (isRestoringState) return 'undo-redo-restore'
  return source === 'local' ? 'canvas-edit' : 'graph-load'
}

const KEY_SEPARATOR = '\0'

function registerKey(graphId: string, nodeId: NodeId, widget: string): string {
  return [graphId, String(nodeId), widget].join(KEY_SEPARATOR)
}

function nodePrefix(graphId: string, nodeId: NodeId): string {
  return `${graphId}${KEY_SEPARATOR}${String(nodeId)}${KEY_SEPARATOR}`
}

interface RememberedAgentWrite {
  value: unknown
  at: number
}

/**
 * Watches the widget-value seam for a later edit that changed a value a live
 * Agent turn wrote, and names the kind of edit responsible (PM-2379).
 *
 * What it cannot see, stated so a silent gap is not read as a clean signal:
 * the register seam only announces a value that actually changed
 * (`observeValue` skips an `Object.is`-equal write). So a restore that puts
 * an Agent-written value back to the widget's own default — `generate_audio`
 * false back to true — announces nothing during `configure`, because the
 * widget is re-registered at that default first and the saved value never
 * differs from it. Replacing a dynamic combo's option swaps its child
 * widgets with no `set_widget` either. Both are real overwrites this records
 * nothing for; what it does guarantee is that neither leaves a stale entry
 * behind to misattribute a later edit, because the load path clears the
 * graph and a removal forgets its node.
 */
export function attachAgentWriteOverwriteWatch(
  deps: AgentWriteOverwriteWatchDeps
): AgentWriteOverwriteWatch {
  const agentWrites = new Map<string, RememberedAgentWrite>()
  let detached = false
  let telemetryReports = 0

  function rememberAgentWrite(key: string, value: unknown): void {
    agentWrites.delete(key)
    agentWrites.set(key, { value, at: performance.now() })
    if (agentWrites.size <= MAX_TRACKED_REGISTERS) return
    const oldest = agentWrites.keys().next()
    if (!oldest.done) agentWrites.delete(oldest.value)
  }

  function forgetNode(graphId: string, nodeId: NodeId): void {
    const prefix = nodePrefix(graphId, nodeId)
    for (const key of agentWrites.keys())
      if (key.startsWith(prefix)) agentWrites.delete(key)
  }

  function forgetGraph(graphId: string): void {
    const prefix = `${graphId}${KEY_SEPARATOR}`
    for (const key of agentWrites.keys())
      if (key.startsWith(prefix)) agentWrites.delete(key)
  }

  function recordOverwrite(
    kind: OverwritingEditKind,
    event: Extract<GraphIntentEvent, { type: 'set_widget' }>,
    agentWrite: RememberedAgentWrite
  ): void {
    const detail = {
      kind,
      graph_id: event.graphId,
      node_id: String(event.nodeId),
      name: event.name,
      agent_value: describeWidgetValue(agentWrite.value),
      replaced_value: describeWidgetValue(event.previous),
      new_value: describeWidgetValue(event.value),
      ms_since_agent_write: Math.round(performance.now() - agentWrite.at)
    }
    recordDevEvent('agent_write_overwritten', detail, { level: 'warn' })
    if (telemetryReports >= MAX_TELEMETRY_REPORTS) return
    telemetryReports++
    reportError(new Error('agent_write_overwritten'), {
      surface: 'agent',
      errorType: 'agent_write_overwritten',
      level: 'warning',
      fingerprint: ['agent_write_overwritten', kind],
      tags: { overwrite_kind: kind, widget: event.name },
      context: {
        ...detail,
        report_index: telemetryReports,
        report_cap: MAX_TELEMETRY_REPORTS
      }
    })
  }

  function onWidgetWrite(
    event: Extract<GraphIntentEvent, { type: 'set_widget' }>
  ): void {
    const key = registerKey(event.graphId, event.nodeId, event.name)
    if (event.source === 'agent-remote') {
      // Every applied frame arrives as `agent-remote`, so remembering all of
      // them would store host baselines, catch-up replays, another tab's
      // `human:*` frames and rejection rollbacks as Agent writes, and report
      // the person's next edit as overwriting a value the Agent never set.
      // Anything that is not a live Agent turn also makes an earlier
      // remembered value stale, so it is forgotten rather than kept.
      if (isLiveAgentTurnWrite()) rememberAgentWrite(key, event.value)
      else agentWrites.delete(key)
      return
    }
    const agentWrite = agentWrites.get(key)
    if (!agentWrite) return
    if (isEqual(agentWrite.value, event.value)) return
    agentWrites.delete(key)
    recordOverwrite(
      editKindOf(event.source, deps.isRestoringState()),
      event,
      agentWrite
    )
  }

  function onIntent(event: GraphIntentEvent): void {
    if (detached) return
    if (!deps.isEnabled()) {
      // Bookkeeping stops with the reporting, so anything remembered before
      // the gate closed would be compared against an edit made while it was
      // closed and reported with a misleading `ms_since_agent_write` once it
      // reopens. Drop the lot instead.
      if (agentWrites.size > 0) agentWrites.clear()
      return
    }
    switch (event.type) {
      case 'set_widget':
        onWidgetWrite(event)
        return
      // Removals and clears are forgotten whatever moved them: an Agent
      // delete, `app.clean()` and `configure({ clearGraph: true })` are not
      // `local`, and node ids are reused, so a kept entry misattributes a
      // later edit to a new occupant of the same id. Widget registers are
      // keyed by the root graph id (`BaseWidget.setNodeId`), while a
      // `remove_node` carries the owning graph — the subgraph for an
      // interior node — so the key has to be rebuilt from `rootGraph`.
      case 'remove_node':
        forgetNode(event.graph.rootGraph.id, event.node.id)
        return
      case 'clear':
        forgetGraph(event.graphId)
        return
      default:
        return
    }
  }

  const detachIntents = onGraphIntent(onIntent)

  return {
    detach() {
      detached = true
      agentWrites.clear()
      detachIntents()
    }
  }
}
