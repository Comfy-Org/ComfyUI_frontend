import { reportError } from '@/platform/telemetry/reportError'
import type { AgentWsEvent } from '../../schemas/agentApiSchema'

type AgentAskData = Extract<AgentWsEvent, { type: 'agent_ask' }>['data']

export type UndeliverableAskReason =
  | 'no-live-turn'
  | 'settled-turn'
  | 'unknown-turn'
  | 'unknown-kind'

export interface UndeliverableAskContext {
  hasActiveTurn?: boolean
  backgroundTurnCount?: number
  activeThreadId?: string | null
  activeTurnId?: string | null
}

const MAX_REPORTS_PER_SESSION = 32
const MAX_IDENTIFIER_LENGTH = 128

function bounded(value: string | null | undefined): string | null | undefined {
  return value?.slice(0, MAX_IDENTIFIER_LENGTH)
}

function identityHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function askIdentity(data: AgentAskData): string {
  return identityHash(`${data.thread_id}\u0000${data.ask_id}`)
}

/** One bounded, identity-aware telemetry path shared by store and transport. */
export function createUndeliverableAskReporter() {
  const reported = new Set<string>()
  const delivered = new Set<string>()
  let reportCount = 0

  function retain(set: Set<string>, key: string): void {
    if (set.has(key)) set.delete(key)
    set.add(key)
    if (set.size <= MAX_REPORTS_PER_SESSION) return
    const oldest = set.values().next().value
    if (oldest !== undefined) set.delete(oldest)
  }

  return {
    report(
      data: AgentAskData,
      reason: UndeliverableAskReason,
      context: UndeliverableAskContext = {}
    ): void {
      const identity = askIdentity(data)
      if (delivered.has(identity) || reportCount >= MAX_REPORTS_PER_SESSION)
        return
      const reportKey = `${identity}\u0000${reason}`
      if (reported.has(reportKey)) return
      retain(reported, reportKey)
      reportCount++

      const knownKind =
        data.kind === 'run_approval' || data.kind === 'ask_user'
          ? data.kind
          : data.kind
            ? 'unknown'
            : 'missing'

      reportError(
        new Error(`agent approval ask could not be delivered (${reason})`),
        {
          errorType: 'failure_delivering_agent_approval_ask',
          level: 'warning',
          tags: {
            reason,
            ask_kind: knownKind,
            has_active_turn: context.hasActiveTurn,
            background_turn_count: context.backgroundTurnCount
          },
          context: {
            threadId: bounded(data.thread_id),
            messageId: bounded(data.message_id),
            rawAskKind: bounded(data.kind),
            activeThreadId: bounded(context.activeThreadId),
            activeTurnId: bounded(context.activeTurnId)
          }
        }
      )
    },
    markDelivered(data: AgentAskData): void {
      retain(delivered, askIdentity(data))
    },
    reset(): void {
      reported.clear()
      delivered.clear()
      reportCount = 0
    }
  }
}
