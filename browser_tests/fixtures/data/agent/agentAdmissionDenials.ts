import type { AgentAdmissionError } from '@comfyorg/ingest-types'

export type AgentAdmissionDenialMock = {
  status: number
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
