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
 * TRANSCRIBED, not derived: `AgentPostMessageErrors` maps both 402 and 503 to
 * the same `AgentAdmissionError`, so nothing in the generated types
 * distinguishes them — the correspondence lives only in the doc comment on
 * `AgentAdmissionError`. The `never` arm is a declaration-time choice with a
 * use-time effect: a newly generated admission status is refused when a mock
 * uses it, rather than silently inheriting `SERVICE_UNAVAILABLE`.
 */
type AdmissionTypeFor<Status extends AdmissionStatus> = Status extends 402
  ? 'PAYMENT_REQUIRED'
  : Status extends 503
    ? 'SERVICE_UNAVAILABLE'
    : never

/**
 * A denial an endpoint could actually return, discriminated on `status`.
 *
 * What it refuses: a status paired with the wrong `error.type`. What it does
 * NOT constrain: `reason`, which the generated type leaves free across all
 * three values for both statuses — so a mock can still pair `manual_block`
 * with a 503. Callers that care assert on the rendered message.
 *
 * An intersection on the generated type, not `Omit`: per
 * `docs/guidance/typescript.md`, omitting a generated field and re-declaring
 * it replaces the contract for that field, so a renamed generated value would
 * stay green. Here `message` and `reason` keep their generated types.
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
