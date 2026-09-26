import type { ChurnkeyAuthResponse } from '@comfyorg/ingest-types'

type ChurnkeyMode = ChurnkeyAuthResponse['mode']

export interface ChurnkeyHandlerResult {
  message?: string
}

interface ChurnkeyCloseResults {
  aborted?: boolean
}

export type ChurnkeySessionOutcome =
  | { type: 'discount-applied' }
  | { type: 'abandoned' }
  | { type: 'closed' }

type ChurnkeyUnsupportedHandler = (
  ...args: unknown[]
) => Promise<ChurnkeyHandlerResult>

export type ChurnkeyOfferConfig =
  | {
      subscriptionId: string
      onDiscount: (customer: unknown, coupon: unknown) => void
      handleDiscount?: never
      customerAttributes: { nativeOfferEligible: true }
    }
  | {
      subscriptionId?: never
      onDiscount?: never
      handleDiscount: ChurnkeyUnsupportedHandler
      customerAttributes: { nativeOfferEligible: false }
    }

export type ChurnkeyInitConfig = ChurnkeyOfferConfig & {
  appId: string
  authHash: string
  customerId: string
  provider: 'stripe'
  mode: ChurnkeyMode
  handleCancel: (
    customer: unknown,
    surveyResponse?: string | null,
    freeformFeedback?: string | null
  ) => Promise<ChurnkeyHandlerResult>
  handlePause: ChurnkeyUnsupportedHandler
  handleTrialExtension: ChurnkeyUnsupportedHandler
  handlePlanChange: ChurnkeyUnsupportedHandler
  handleRebate: ChurnkeyUnsupportedHandler
  handleRedirect: ChurnkeyUnsupportedHandler
  onClose: (results: ChurnkeyCloseResults) => void
  onError: (error: unknown, type?: string) => void
}

export type ChurnkeyInit = (action: 'show', config: ChurnkeyInitConfig) => void

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
