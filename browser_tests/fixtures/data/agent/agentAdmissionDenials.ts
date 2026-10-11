import type {
  AgentAdmissionError,
  AgentPostMessageErrors
} from '@comfyorg/ingest-types'

/** The statuses the generated contract maps to an admission denial. */
type AdmissionStatus = {
  [Status in keyof AgentPostMessageErrors]: AgentPostMessageErrors[Status] extends AgentAdmissionError
    ? Status
    : never
}[keyof AgentPostMessageErrors]

/**
 * The `error.type` the generated contract pairs with each of those statuses.
 *
 * Exhaustive on purpose: a status the generated types start mapping to an
 * admission denial, and that is not listed here, resolves to `never` and makes
 * its mock a compile error. A trailing `: 'SERVICE_UNAVAILABLE'` would instead
 * quietly assign the new status the wrong type.
 *
 * The pairing itself is TRANSCRIBED, not derived, and that limit is worth
 * naming: `AgentPostMessageErrors` maps both 402 and 503 to the same
 * `AgentAdmissionError`, so nothing in the generated types distinguishes them —
 * the correspondence lives only in the doc comment on `AgentAdmissionError`
 * ("`PAYMENT_REQUIRED` (402) … `SERVICE_UNAVAILABLE` (503)").
 */
type AdmissionTypeFor<Status extends AdmissionStatus> = Status extends 402
  ? 'PAYMENT_REQUIRED'
  : Status extends 503
    ? 'SERVICE_UNAVAILABLE'
    : never

/**
 * A denial an endpoint could actually return, discriminated on `status`, so a
 * combination the server cannot produce — a 503 carrying `PAYMENT_REQUIRED` —
 * is a type error rather than a mock that sends the client down the generic
 * send-failure path and leaves an admission test green.
 *
 * An intersection on the generated type, not `Omit`: per
 * `docs/guidance/typescript.md`, omitting a generated field and re-declaring it
 * replaces the contract for that field, so a renamed generated value would stay
 * green. Here `message` and `reason` keep their generated types and `type` is
 * narrowed by intersection.
 */
export type AgentAdmissionDenialMock = {
  [Status in AdmissionStatus]: {
    status: Status
    body: AgentAdmissionError & { error: { type: AdmissionTypeFor<Status> } }
    retryAfterSeconds: number
  }
}[AdmissionStatus]

export const MANUAL_BLOCK_ADMISSION_MESSAGE =
  'This account cannot run the agent.'

export const MANUAL_BLOCK_ADMISSION_DENIAL = {
  status: 402,
  body: {
    error: {
      message: MANUAL_BLOCK_ADMISSION_MESSAGE,
      reason: 'manual_block',
      type: 'PAYMENT_REQUIRED'
    }
  },
  retryAfterSeconds: 45
} satisfies AgentAdmissionDenialMock
