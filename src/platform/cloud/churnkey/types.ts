import type { ChurnkeyAuthResponse } from '@comfyorg/ingest-types'

type ChurnkeyMode = ChurnkeyAuthResponse['mode']

export interface ChurnkeyHandlerResult {
  message?: string
}

export type ChurnkeySessionResults = unknown

type ChurnkeyUnsupportedHandler = (
  ...args: unknown[]
) => Promise<ChurnkeyHandlerResult>

export interface ChurnkeyInitConfig {
  appId: string
  authHash: string
  customerId: string
  provider: 'stripe'
  mode: ChurnkeyMode
  record: false
  i18n: {
    lang: string
  }
  customerAttributes?: Record<string, string | number | boolean>
  handleCancel: (
    customer: unknown,
    surveyResponse?: string | null,
    freeformFeedback?: string | null
  ) => Promise<ChurnkeyHandlerResult>
  handlePause: ChurnkeyUnsupportedHandler
  handleDiscount: ChurnkeyUnsupportedHandler
  handleTrialExtension: ChurnkeyUnsupportedHandler
  handlePlanChange: ChurnkeyUnsupportedHandler
  handleRebate: ChurnkeyUnsupportedHandler
  handleRedirect: ChurnkeyUnsupportedHandler
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
