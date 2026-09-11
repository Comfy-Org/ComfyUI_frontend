import type { ChurnkeyAuthResponse } from '@comfyorg/ingest-types'

type ChurnkeyMode = ChurnkeyAuthResponse['mode']

export interface ChurnkeyHandlerResult {
  message?: string
}

export interface ChurnkeySessionResults {
  aborted?: boolean
  outcome?: 'retained' | 'canceled'
}

type ChurnkeyOfferHandler = (
  ...args: unknown[]
) => Promise<ChurnkeyHandlerResult>

interface ChurnkeyBaseConfig {
  appId: string
  authHash: string
  mode: ChurnkeyMode
  handleCancel: (
    customer: unknown,
    surveyResponse?: string | null,
    freeformFeedback?: string | null
  ) => Promise<ChurnkeyHandlerResult>
  onClose: (results: ChurnkeySessionResults) => void
  onError: (error: unknown, type?: string) => void
}

interface ChurnkeyStripeConfig extends ChurnkeyBaseConfig {
  provider: 'stripe'
  customerId: string
  handlePause: ChurnkeyOfferHandler
  handleDiscount: ChurnkeyOfferHandler
  handleTrialExtension: ChurnkeyOfferHandler
  handlePlanChange: ChurnkeyOfferHandler
  handleRebate: ChurnkeyOfferHandler
  handleRedirect: ChurnkeyOfferHandler
}

interface ChurnkeyDirectConfig extends ChurnkeyBaseConfig {
  provider: 'direct'
  customer: { id: string }
  subscriptions: {
    id: string
    start: Date
    status: {
      name: 'active'
      currentPeriod: { start: Date; end: Date }
    }
    items: {
      price: {
        id: string
        amount: { value: number; currency: string }
        interval: 'month' | 'year'
        intervalCount: number
      }
      quantity: number
    }[]
  }[]
  handleDiscount?: ChurnkeyOfferHandler
  onStepChange: (step: unknown) => void
}

export type ChurnkeyInitConfig = ChurnkeyStripeConfig | ChurnkeyDirectConfig
export type ChurnkeyInit = (
  action: 'show',
  config: ChurnkeyInitConfig
) => void | Promise<void>

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
