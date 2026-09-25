import type {
  AgentAdmissionError,
  AgentPostMessageErrors
} from '@comfyorg/ingest-types'

export type AgentAdmissionDenialMock = {
  status: {
    [Status in keyof AgentPostMessageErrors]: AgentPostMessageErrors[Status] extends AgentAdmissionError
      ? Status
      : never
  }[keyof AgentPostMessageErrors]
  body: AgentAdmissionError
  retryAfterSeconds: number
}

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
