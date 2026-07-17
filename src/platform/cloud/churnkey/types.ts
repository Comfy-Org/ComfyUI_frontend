export type ChurnkeyMode = 'live' | 'test' | 'sandbox'

export interface ChurnkeyHandlerResult {
  message?: string
}

export interface ChurnkeySessionResults {
  aborted?: boolean
  canceled?: boolean
  acceptedOffer?: Record<string, unknown> | null
  [key: string]: unknown
}

export type ChurnkeyBillingInterval = 'day' | 'week' | 'month' | 'year'

interface ChurnkeyDirectCustomer {
  id: string
}

export interface ChurnkeyDirectSubscription {
  id: string
  start: Date
  status: {
    name: 'active'
    currentPeriod: {
      start: Date
      end: Date
    }
  }
  items: Array<{
    price: {
      id: string
      name?: string
      amount: {
        value: number
        currency: string
      }
      interval: ChurnkeyBillingInterval
      intervalCount: number
    }
    quantity: number
  }>
}

export interface ChurnkeyInitConfig {
  appId: string
  authHash: string
  provider: 'direct'
  mode: ChurnkeyMode
  customer: ChurnkeyDirectCustomer
  subscriptions: ChurnkeyDirectSubscription[]
  customerAttributes?: Record<string, string | number | boolean>
  handleCancel: (
    customer: ChurnkeyDirectCustomer,
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
