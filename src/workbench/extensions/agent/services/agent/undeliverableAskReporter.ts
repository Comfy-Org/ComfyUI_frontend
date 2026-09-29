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

/** One bounded, identity-aware telemetry path shared by store and transport. */
export function createUndeliverableAskReporter() {
  const reportedAskIds = new Set<string>()

  return {
    report(
      data: AgentAskData,
      reason: UndeliverableAskReason,
      context: UndeliverableAskContext = {}
    ): void {
      if (
        reportedAskIds.has(data.ask_id) ||
        reportedAskIds.size >= MAX_REPORTED_ASKS
      )
        return
      reportedAskIds.add(data.ask_id)

      const askKind =
        data.kind === undefined
          ? 'missing'
          : data.kind === 'run_approval' || data.kind === 'ask_user'
            ? data.kind
            : 'unknown'

      reportError(
        new Error(`agent approval ask could not be delivered (${reason})`),
        {
          errorType: 'failure_delivering_agent_approval_ask',
          level: 'warning',
          tags: {
            reason,
            ask_kind: askKind,
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
