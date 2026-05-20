// Subset of the Churnkey embed API. No official @types package exists.
// Docs: https://docs.churnkey.co/cancel-flows/further-configuration/

export type ChurnkeyMode = 'live' | 'test' | 'sandbox'

export type ChurnkeyProvider = 'stripe' | 'chargebee' | 'braintree' | 'paddle'

export interface ChurnkeyHandlerResult {
  message?: string
}

export interface ChurnkeyInitConfig {
  appId: string
  authHash: string
  customerId: string
  subscriptionId?: string
  provider: ChurnkeyProvider
  mode: ChurnkeyMode
  record?: boolean
  preview?: boolean
  report?: boolean
  bypassDiscountAppliedScreen?: boolean
  bypassPauseAppliedScreen?: boolean
  customerAttributes?: Record<string, string | number>

  handleCancel?: (
    customer: string,
    surveyResponse: string,
    freeformFeedback?: string
  ) => Promise<ChurnkeyHandlerResult>
  handleSupportRequest?: (customer: string) => void

  onCancel?: (customer: string, surveyResponse: string) => void
  onClose?: (sessionResults: ChurnkeySessionResults) => void
  onGoToAccount?: (sessionResults: ChurnkeySessionResults) => void
}

export interface ChurnkeySessionResults {
  status?: 'canceled' | 'discounted' | 'paused' | 'closed'
  [key: string]: unknown
}
