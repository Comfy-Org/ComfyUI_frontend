import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

import './embed-theme.css'
import type {
  ChurnkeyHandlerResult,
  ChurnkeyInitConfig,
  ChurnkeySessionResults
} from './types'

function readAppId(): string {
  return __CHURNKEY_APP_ID__
}

/**
 * Thrown when the backend's `/billing/churnkey/auth` endpoint is missing.
 */
export class ChurnkeyAuthUnavailableError extends Error {
  constructor() {
    super('Churnkey auth endpoint not available')
    this.name = 'ChurnkeyAuthUnavailableError'
  }
}

interface ChurnkeyShowOptions {
  handleCancel: (
    surveyResponse: string,
    freeformFeedback?: string
  ) => Promise<ChurnkeyHandlerResult>
  onClose?: (results: ChurnkeySessionResults) => void
  onCancel?: (surveyResponse: string) => void
  customerAttributes?: Record<string, string | number>
}

export function useChurnkey() {
  const appId = readAppId()
  const isConfigured = !!appId

  async function show(options: ChurnkeyShowOptions): Promise<void> {
    if (!appId) {
      throw new Error('Churnkey is not configured (missing CHURNKEY_APP_ID)')
    }

    if (typeof window === 'undefined' || !window.churnkey?.init) {
      throw new Error('Churnkey embed script has not loaded')
    }

    const auth = await workspaceApi.getChurnkeyAuth()
    if (auth === null) {
      throw new ChurnkeyAuthUnavailableError()
    }

    const config: ChurnkeyInitConfig = {
      appId,
      authHash: auth.auth_hash,
      customerId: auth.customer_id,
      subscriptionId: auth.subscription_id,
      provider: 'stripe',
      mode: auth.mode,
      record: true,
      customerAttributes: options.customerAttributes,
      handleCancel: (_customer, surveyResponse, freeformFeedback) =>
        options.handleCancel(surveyResponse, freeformFeedback),
      onCancel: (_customer, surveyResponse) =>
        options.onCancel?.(surveyResponse),
      onClose: (results) => options.onClose?.(results)
    }

    window.churnkey.init('show', config)
  }

  return {
    isConfigured,
    show
  }
}
