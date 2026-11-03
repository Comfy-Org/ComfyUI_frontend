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

const MAX_TELEMETRY_REPORTS_PER_SESSION = 32

export function describeWidgetValue(value: unknown): WidgetValueShape {
  if (value === null) return { type: 'null' }
  switch (typeof value) {
    case 'undefined':
      return { type: 'undefined' }
    case 'boolean':
      return { type: 'boolean', literal: value }
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
 * Records which later edit changed a value a live Agent turn wrote (PM-2379).
 * Reads the widget-value seam only; never writes. Known blind spots are in
 * the pull request description.
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
    if (telemetryReports >= MAX_TELEMETRY_REPORTS_PER_SESSION) return
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
        report_cap: MAX_TELEMETRY_REPORTS_PER_SESSION
      }
    })
  }

  function onWidgetWrite(
    event: Extract<GraphIntentEvent, { type: 'set_widget' }>
  ): void {
    const key = registerKey(event.graphId, event.nodeId, event.name)
    if (event.source === 'agent-remote') {
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
      agentWrites.clear()
      return
    }
    switch (event.type) {
      case 'set_widget':
        onWidgetWrite(event)
        return
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
