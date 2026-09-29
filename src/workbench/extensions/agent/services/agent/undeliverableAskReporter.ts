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

const MAX_IDENTITY_REPORTS = 32
const KNOWN_ASK_KINDS = new Set(['run_approval', 'ask_user'])

function askKindTag(kind: string | undefined): string {
  if (!kind) return 'missing'
  return KNOWN_ASK_KINDS.has(kind) ? kind : 'other'
}

/** One bounded, identity-aware telemetry path shared by store and transport. */
export function createUndeliverableAskReporter() {
  const reportedAskKeys = new Set<string>()
  const reportedOutcomes = new Set<string>()
  let identityReportCount = 0

  return {
    report(
      data: AgentAskData,
      reason: UndeliverableAskReason,
      context: UndeliverableAskContext = {}
    ): void {
      const askKey = `${data.thread_id}\u0000${data.ask_id}`
      if (reportedAskKeys.has(askKey)) return

      const askKind = askKindTag(data.kind)
      const outcomeKey = `${reason}\u0000${askKind}`
      const isNewOutcome = !reportedOutcomes.has(outcomeKey)
      if (identityReportCount >= MAX_IDENTITY_REPORTS && !isNewOutcome) return

      reportedAskKeys.add(askKey)
      reportedOutcomes.add(outcomeKey)
      if (!isNewOutcome || identityReportCount < MAX_IDENTITY_REPORTS)
        identityReportCount++

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
      reportedAskKeys.clear()
      reportedOutcomes.clear()
      identityReportCount = 0
    }
  }
}
