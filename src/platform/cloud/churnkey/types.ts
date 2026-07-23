import type { ChurnkeyAuthResponse } from './churnkeyAuthSchema'

type ChurnkeyMode = ChurnkeyAuthResponse['mode']

export interface ChurnkeyHandlerResult {
  message?: string
}

export interface ChurnkeySessionResults {
  status?: 'canceled' | 'discounted' | 'paused' | 'closed'
  acceptedOffer?: Record<string, unknown> | null
  [key: string]: unknown
}

export interface ChurnkeyInitConfig {
  appId: string
  authHash: string
  customerId: string
  provider: 'stripe'
  mode: ChurnkeyMode
  customerAttributes?: Record<string, string | number | boolean>
  handleCancel: (
    customer: string,
    surveyResponse: string,
    freeformFeedback?: string
  ) => Promise<ChurnkeyHandlerResult>
  onClose: (results: ChurnkeySessionResults) => void
  onError: (error: unknown, type?: string) => void
}

export type ChurnkeyInit = (
  action: 'show' | 'restart',
  config: ChurnkeyInitConfig
) => void

interface ChurnkeyWindow {
  created?: boolean
  init?: ChurnkeyInit
  hide?: () => void
  clearState?: () => void
}

declare global {
  interface Window {
    churnkey?: ChurnkeyWindow
  }
}
