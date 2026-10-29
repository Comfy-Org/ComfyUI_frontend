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
  gate: HeldGate
  clientMessageId: string
  threadId: string | null
  since: number
}

/** Reports what happens to a send before its turn POST. */
export function useAgentSendGates(threadId: () => string | null) {
  const holds = new Set<Hold>()

  function hold(gate: HeldGate, clientMessageId: string): void {
    const held: Hold = {
      gate,
      clientMessageId,
      threadId: threadId(),
      since: performance.now()
    }
    holds.add(held)
    useTelemetry()?.trackAgentSendGated({
      gate,
      outcome: 'held',
      reason: null,
      client_message_id: clientMessageId,
      held_ms: null,
      thread_id: held.threadId
    })
  }

  function end(holdEnd: HoldEnd, clientMessageId?: string): void {
    for (const held of holds) {
      if (held.gate !== holdEnd.gate) continue
      if (clientMessageId && held.clientMessageId !== clientMessageId) continue
      holds.delete(held)
      useTelemetry()?.trackAgentSendGated({
        ...holdEnd,
        client_message_id: held.clientMessageId,
        held_ms: Math.round(performance.now() - held.since),
        thread_id: held.threadId
      })
    }
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
