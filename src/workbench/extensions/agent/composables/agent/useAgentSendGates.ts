import { useTelemetry } from '@comfyorg/telemetry'
import type {
  AgentCoachDropReason,
  AgentCoachReleaseReason,
  AgentComposerDropReason,
  AgentConsentDropReason
} from '@comfyorg/telemetry/types'

type HeldGate = 'consent' | 'coach'

export type CoachHoldEnd =
  | { outcome: 'released'; reason: AgentCoachReleaseReason }
  | { outcome: 'dropped'; reason: AgentCoachDropReason }

type HoldEnd =
  | { gate: 'consent'; outcome: 'released'; reason: 'accepted' }
  | { gate: 'consent'; outcome: 'dropped'; reason: AgentConsentDropReason }
  | ({ gate: 'coach' } & CoachHoldEnd)

interface Hold {
  clientMessageId: string
  since: number
}

/**
 * Reports what happens to a send before its turn POST. Each gate holds at most
 * one send, and only the first `end` after a `hold` is reported, so every
 * `held` gets exactly one `released` or `dropped`.
 */
export function useAgentSendGates(threadId: () => string | null) {
  const holds = new Map<HeldGate, Hold>()

  function hold(gate: HeldGate, clientMessageId: string): void {
    holds.set(gate, { clientMessageId, since: performance.now() })
    useTelemetry()?.trackAgentSendGated({
      gate,
      outcome: 'held',
      reason: null,
      client_message_id: clientMessageId,
      held_ms: null,
      thread_id: threadId()
    })
  }

  function end(holdEnd: HoldEnd): void {
    const held = holds.get(holdEnd.gate)
    if (!held) return
    holds.delete(holdEnd.gate)
    useTelemetry()?.trackAgentSendGated({
      ...holdEnd,
      client_message_id: held.clientMessageId,
      held_ms: Math.round(performance.now() - held.since),
      thread_id: threadId()
    })
  }

  function rejectDraft(reason: AgentComposerDropReason): void {
    useTelemetry()?.trackAgentSendGated({
      gate: 'composer',
      outcome: 'dropped',
      reason,
      client_message_id: null,
      held_ms: null,
      thread_id: threadId()
    })
  }

  return { hold, end, rejectDraft }
}
