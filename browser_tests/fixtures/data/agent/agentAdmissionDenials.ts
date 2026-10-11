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
 * This pairing is TRANSCRIBED, not derived, and that limit is the point of
 * writing it down: `AgentPostMessageErrors` maps both 402 and 503 to the same
 * `AgentAdmissionError`, so nothing in the generated types distinguishes them
 * — the correspondence lives only in the doc comment on `AgentAdmissionError`
 * ("`PAYMENT_REQUIRED` (402) … `SERVICE_UNAVAILABLE` (503)"). So this union
 * stops a mock that pairs a status with the wrong type from compiling, and it
 * does NOT track a future generated change to the pairing on its own.
 */
type AdmissionTypeFor<Status extends AdmissionStatus> = Status extends 402
  ? 'PAYMENT_REQUIRED'
  : 'SERVICE_UNAVAILABLE'

/**
 * A denial an endpoint could actually return. Discriminated on `status` so a
 * combination the server cannot produce — a 503 carrying `PAYMENT_REQUIRED`,
 * say — is a type error rather than a mock that quietly sends the client down
 * the generic send-failure path and leaves an admission test green.
 */
export type AgentAdmissionDenialMock = {
  [Status in AdmissionStatus]: {
    status: Status
    body: {
      error: Omit<AgentAdmissionError['error'], 'type'> & {
        type: AdmissionTypeFor<Status>
      }
    }
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
