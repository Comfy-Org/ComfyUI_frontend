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

const MAX_REPORTS_PER_SESSION = 32
const KNOWN_ASK_KINDS = new Set(['run_approval', 'ask_user'])

/** One bounded, identity-aware telemetry path shared by store and transport. */
export function createUndeliverableAskReporter() {
  const reportedAskReasons = new Set<string>()
  let reportCount = 0

  return {
    report(
      data: AgentAskData,
      reason: UndeliverableAskReason,
      context: UndeliverableAskContext = {}
    ): void {
      const reportKey = `${data.ask_id}\u0000${reason}`
      if (reportedAskReasons.has(reportKey)) return
      reportedAskReasons.add(reportKey)
      if (reportCount >= MAX_REPORTS_PER_SESSION) return
      reportCount += 1

      const askKind =
        data.kind === undefined
          ? 'missing'
          : KNOWN_ASK_KINDS.has(data.kind)
            ? data.kind
            : 'other'

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
      reportedAskReasons.clear()
      reportCount = 0
    }
  }
}
