import type { AgentReconnectSucceededMetadata } from '@/platform/telemetry/types'

/**
 * TEL-10's recovery bookkeeping as one state rather than a bag of fields.
 *
 * A recovery has exactly three phases: nothing in flight, a disconnect signal
 * seen but not yet answered, and an answered subscribe whose report is waiting
 * for the catch-up frame that proves how much was replayed. The report is not
 * emitted at the ack because the relay sends the ack first and the catch-up
 * `doc_update` (same seq as the ack) after it.
 *
 * `fromVersion` is supplied by the caller, never read off the transport: the
 * bridge clears its sequence bookkeeping the moment a subscribe frame leaves,
 * so by the time a refusal comes back it no longer knows where the follower
 * was.
 */
export type ReconnectState =
  | { phase: 'idle' }
  | {
      phase: 'inFlight'
      startedAt: number
      fromVersion: number
      /**
       * The relay joins the fanout before it acks, so frames can arrive ahead
       * of the ack that says which of them are catch-up. They are held here
       * until the ack seq can classify them.
       */
      preAck: readonly { seq: number; bytes: number }[]
    }
  | {
      phase: 'pending'
      ackSeq: number
      report: AgentReconnectSucceededMetadata
    }

export type ReconnectEvent =
  /** A socket drop or a server refusal, i.e. the recovery clock starts. */
  | { type: 'disconnected'; at: number; fromVersion: number }
  | { type: 'confirmed'; at: number; ackSeq: number | null; attempt: number }
  | { type: 'update'; seq: number; bytes: number }
  /** The binding is going away; report whatever succeeded, drop the rest. */
  | { type: 'flushed' }
  /** The binding is going away and nothing about it is reportable. */
  | { type: 'abandoned' }

export interface ReconnectTransition {
  state: ReconnectState
  report: AgentReconnectSucceededMetadata | null
}

export const initialReconnectState: ReconnectState = { phase: 'idle' }

const idle = (
  report: AgentReconnectSucceededMetadata | null = null
): ReconnectTransition => ({ state: initialReconnectState, report })

const unchanged = (state: ReconnectState): ReconnectTransition => ({
  state,
  report: null
})

export function reduceReconnect(
  state: ReconnectState,
  event: ReconnectEvent
): ReconnectTransition {
  switch (event.type) {
    case 'disconnected': {
      // A disconnect while a report is pending is a NEW recovery, so the
      // pending one is reported before the clock restarts. A second signal
      // mid-recovery must not reset the clock or the baseline.
      if (state.phase === 'inFlight') return unchanged(state)
      return {
        state: {
          phase: 'inFlight',
          startedAt: event.at,
          fromVersion: event.fromVersion,
          preAck: []
        },
        report: state.phase === 'pending' ? state.report : null
      }
    }
    case 'confirmed': {
      // A second ok ack while pending (the stale probe's resubscribe) proves
      // no catch-up is coming.
      if (state.phase === 'pending') return idle(state.report)
      if (state.phase === 'idle') return unchanged(state)
      const report: AgentReconnectSucceededMetadata = {
        attempt: event.attempt,
        reconnect_duration_ms: Math.max(
          0,
          Math.round(event.at - state.startedAt)
        ),
        replayed_bytes: 0,
        from_version: state.fromVersion,
        to_version: 0
      }
      if (event.ackSeq === null) return idle(report)
      const ackSeq = event.ackSeq
      const replayed = state.preAck
      const confirmed = {
        ...report,
        to_version: ackSeq,
        replayed_bytes: replayed.reduce(
          (total, frame) => total + frame.bytes,
          0
        )
      }
      // The catch-up frame overtook its own ack, so there is nothing left to
      // wait for.
      const catchUpAlreadyLanded = replayed.some(
        (frame) => frame.seq === ackSeq
      )
      return catchUpAlreadyLanded
        ? idle(confirmed)
        : unchanged({ phase: 'pending', ackSeq, report: confirmed })
    }
    case 'update': {
      if (state.phase === 'idle') return unchanged(state)
      if (state.phase === 'inFlight')
        return unchanged({
          ...state,
          preAck: [...state.preAck, { seq: event.seq, bytes: event.bytes }]
        })
      // A frame above the ack seq is live traffic: it proves the catch-up was
      // empty (or already counted) and is not part of it.
      if (event.seq > state.ackSeq) return idle(state.report)
      const report = {
        ...state.report,
        replayed_bytes: state.report.replayed_bytes + event.bytes
      }
      return event.seq === state.ackSeq
        ? idle(report)
        : unchanged({ ...state, report })
    }
    case 'flushed':
      return state.phase === 'pending' ? idle(state.report) : unchanged(state)
    case 'abandoned':
      return idle()
  }
}
