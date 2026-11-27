import type {
  AgentMessages,
  TurnId
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { AssistantMessage } from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import type { UserAttachment } from '@/workbench/extensions/agent/services/agent/agentTranscript'
import type { SkillReference } from '@/workbench/extensions/agent/types/skillReference'
import type { WorkflowReference } from '@/workbench/extensions/agent/types/workflowReference'

export interface KnownTurnSnapshot {
  turnId: TurnId
  clientMessageId?: string
  userText?: string
  attachments?: UserAttachment[]
  tags?: string[]
  workflowReferences?: WorkflowReference[]
  skillReference?: SkillReference
  message: AssistantMessage
}

export interface KnownChatState {
  createdHere: boolean
  fetchedFromServer: boolean
  version: number
  baseHistory: AgentMessages
  latestWorkflowId?: string
  localTurns: KnownTurnSnapshot[]
}

type KnownChatAlignment =
  | {
      status: 'aligned'
      history: AgentMessages
      settledServerTurns: Set<TurnId>
      serverTurnToLocal: Map<string, TurnId>
    }
  | { status: 'ambiguous' }
  | { status: 'unowned-streaming' }

function rowClientMessageId(row: AgentMessages[number]): string | undefined {
  const value = row.content?.client_message_id
  return typeof value === 'string' && value !== '' ? value : undefined
}

function settledAssistantTurnIds(history: AgentMessages): Set<TurnId> {
  const newestStatus = new Map<TurnId, string>()
  for (const row of [...history].sort((a, b) => a.seq - b.seq)) {
    if (row.role === 'assistant')
      newestStatus.set(toTurnId(row.turn_id), row.status)
  }
  const settled = new Set<TurnId>()
  for (const [turnId, status] of newestStatus) {
    if (status !== 'streaming') settled.add(turnId)
  }
  return settled
}

function activeStreamingTurnIds(history: AgentMessages): Set<TurnId> {
  const newestStatus = new Map<TurnId, string>()
  for (const row of [...history].sort((a, b) => a.seq - b.seq)) {
    if (row.role === 'assistant')
      newestStatus.set(toTurnId(row.turn_id), row.status)
  }
  const streaming = new Set<TurnId>()
  for (const [turnId, status] of newestStatus) {
    if (status === 'streaming') streaming.add(turnId)
  }
  return streaming
}

function matchStrictRowTurn(
  row: AgentMessages[number],
  localIds: ReadonlySet<TurnId>,
  byClientId: ReadonlyMap<string, TurnId>
): TurnId | undefined {
  if (row.role === 'assistant') {
    const rowId = toTurnId(row.id)
    if (localIds.has(rowId)) return rowId
    const turnId = toTurnId(row.turn_id)
    return localIds.has(turnId) ? turnId : undefined
  }
  if (row.role === 'user') {
    const clientId = rowClientMessageId(row)
    if (clientId !== undefined) {
      const byClient = byClientId.get(clientId)
      if (byClient !== undefined) return byClient
    }
    const byRowId = byClientId.get(row.id)
    if (byRowId !== undefined) return byRowId
    const turnId = toTurnId(row.turn_id)
    return localIds.has(turnId) ? turnId : undefined
  }
  return undefined
}

function collectStrictMappings(
  history: AgentMessages,
  localTurns: readonly KnownTurnSnapshot[]
): {
  serverTurnToLocal: Map<string, TurnId>
  matchedLocalIds: Set<TurnId>
  conflict: boolean
} {
  const localIds = new Set<TurnId>()
  const byClientId = new Map<string, TurnId>()
  for (const turn of localTurns) {
    localIds.add(turn.turnId)
    if (turn.clientMessageId !== undefined)
      byClientId.set(turn.clientMessageId, turn.turnId)
  }

  const serverTurnToLocal = new Map<string, TurnId>()
  const localToServerTurn = new Map<TurnId, string>()
  for (const row of history) {
    const match = matchStrictRowTurn(row, localIds, byClientId)
    if (match === undefined) continue
    const priorLocal = serverTurnToLocal.get(row.turn_id)
    if (priorLocal !== undefined && priorLocal !== match)
      return { serverTurnToLocal, matchedLocalIds: new Set(), conflict: true }
    const priorServer = localToServerTurn.get(match)
    if (priorServer !== undefined && priorServer !== row.turn_id)
      return { serverTurnToLocal, matchedLocalIds: new Set(), conflict: true }
    serverTurnToLocal.set(row.turn_id, match)
    localToServerTurn.set(match, row.turn_id)
  }

  return {
    serverTurnToLocal,
    matchedLocalIds: new Set(localToServerTurn.keys()),
    conflict: false
  }
}

export function alignKnownChatHistory(
  history: AgentMessages,
  baseHistory: AgentMessages,
  localTurns: readonly KnownTurnSnapshot[]
): KnownChatAlignment {
  if (localTurns.length === 0) {
    if (activeStreamingTurnIds(history).size > 0)
      return { status: 'unowned-streaming' }
    return {
      status: 'aligned',
      history,
      settledServerTurns: settledAssistantTurnIds(history),
      serverTurnToLocal: new Map()
    }
  }

  const { serverTurnToLocal, matchedLocalIds, conflict } =
    collectStrictMappings(history, localTurns)
  if (conflict) return { status: 'ambiguous' }

  const aligned =
    serverTurnToLocal.size === 0
      ? history
      : history.map((row) => {
          const mapped = serverTurnToLocal.get(row.turn_id)
          return mapped === undefined || row.turn_id === mapped
            ? row
            : { ...row, turn_id: mapped }
        })

  const baseTurnIds = new Set(baseHistory.map((row) => row.turn_id))
  const localIds = new Set(localTurns.map((turn) => turn.turnId))
  const streamingTurns = activeStreamingTurnIds(aligned)
  for (const streamingId of streamingTurns) {
    if (!localIds.has(streamingId))
      return {
        status:
          matchedLocalIds.size < localTurns.length
            ? 'ambiguous'
            : 'unowned-streaming'
      }
  }

  if (matchedLocalIds.size < localTurns.length) {
    const assistantTurns = new Set(
      aligned
        .filter((row) => row.role === 'assistant')
        .map((row) => row.turn_id)
    )
    const hasAmbiguousUserOnlyTurn = aligned.some(
      (row) =>
        row.role === 'user' &&
        !localIds.has(toTurnId(row.turn_id)) &&
        !baseTurnIds.has(row.turn_id) &&
        !assistantTurns.has(row.turn_id) &&
        rowClientMessageId(row) === undefined
    )
    if (hasAmbiguousUserOnlyTurn) return { status: 'ambiguous' }
  }

  return {
    status: 'aligned',
    history: aligned,
    settledServerTurns: settledAssistantTurnIds(aligned),
    serverTurnToLocal
  }
}

export function pruneSettledLocalTurns(
  localTurns: readonly KnownTurnSnapshot[],
  settledServerTurns: ReadonlySet<TurnId>
): KnownTurnSnapshot[] {
  return localTurns.filter((turn) => !settledServerTurns.has(turn.turnId))
}

export function latestWorkflowIdOf(history: AgentMessages): string | undefined {
  return history.findLast(
    (row) => row.role === 'assistant' && Boolean(row.workflow_id)
  )?.workflow_id
}
