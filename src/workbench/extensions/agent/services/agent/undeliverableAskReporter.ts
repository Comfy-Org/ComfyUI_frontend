import { reportError } from '@/platform/telemetry/reportError'
import type { AgentWsEvent } from '../../schemas/agentApiSchema'

type AgentAskData = Extract<AgentWsEvent, { type: 'agent_ask' }>['data']

export type UndeliverableAskReason =
  | 'no-live-turn'
  | 'settled-turn'
  | 'unknown-kind'
  | 'unrendered-kind'

export interface UndeliverableAskContext {
  hasActiveTurn?: boolean
  backgroundTurnCount?: number
  activeThreadId?: string | null
  activeTurnId?: string | null
}

const MAX_REPORTED_ASKS = 32
const KNOWN_ASK_KINDS = new Set(['run_approval', 'ask_user'])

function askKindTag(kind: string | undefined): string {
  if (!kind) return 'missing'
  return KNOWN_ASK_KINDS.has(kind) ? kind : 'other'
}

/** One bounded, identity-aware telemetry path shared by store and transport. */
export function createUndeliverableAskReporter() {
  const reportedAskIds = new Set<string>()

  return {
    report(
      data: AgentAskData,
      reason: UndeliverableAskReason,
      context: UndeliverableAskContext = {}
    ): void {
      if (reportedAskIds.has(data.ask_id)) return
      reportedAskIds.add(data.ask_id)
      if (reportedAskIds.size > MAX_REPORTED_ASKS) {
        const oldest = reportedAskIds.values().next().value
        if (oldest !== undefined) reportedAskIds.delete(oldest)
      }

      reportError(
        new Error(`agent approval ask could not be delivered (${reason})`),
        {
          errorType: 'failure_delivering_agent_approval_ask',
          level: 'warning',
          tags: {
            reason,
            ask_kind: askKindTag(data.kind),
            has_active_turn: context.hasActiveTurn,
            background_turn_count: context.backgroundTurnCount
          },
          context: {
            threadId: data.thread_id,
            messageId: data.message_id,
            askKind: data.kind,
            activeThreadId: context.activeThreadId,
            activeTurnId: context.activeTurnId
          }
        }
      )
    },
    reset(): void {
      reportedAskIds.clear()
    }
  }
}
