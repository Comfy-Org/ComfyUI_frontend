import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

import './embed-theme.css'
import type {
  ChurnkeyHandlerResult,
  ChurnkeyInitConfig,
  ChurnkeySessionResults
} from './types'

function readAppId(): string {
  // E2e hook: `__CHURNKEY_APP_ID__` is a compile-time define, so a built
  // bundle can't be reconfigured per test. Playwright sets this global to
  // exercise the Churnkey routing without a build-time app ID.
  const override =
    typeof window !== 'undefined'
      ? (window as { __CHURNKEY_APP_ID_OVERRIDE__?: string })
          .__CHURNKEY_APP_ID_OVERRIDE__
      : undefined
  return override || __CHURNKEY_APP_ID__
}

/**
 * Thrown when the backend's `/billing/churnkey/auth` endpoint is missing
 * (e.g. backend hasn't been deployed yet). Callers should treat this the
 * same as Churnkey not being configured at all and fall back to the
 * legacy cancel dialog rather than surfacing a toast.
 */
export class ChurnkeyAuthUnavailableError extends Error {
  constructor() {
    super('Churnkey auth endpoint not available')
    this.name = 'ChurnkeyAuthUnavailableError'
  }
}

interface ChurnkeyShowOptions {
  handleCancel?: (
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
      provider: 'stripe',
      mode: auth.mode,
      record: true,
      customerAttributes: options.customerAttributes,
      onCancel: (_customer, surveyResponse) =>
        options.onCancel?.(surveyResponse),
      onClose: (results) => options.onClose?.(results)
    }
    if (options.handleCancel) {
      const userHandleCancel = options.handleCancel
      config.handleCancel = (_customer, surveyResponse, freeformFeedback) =>
        userHandleCancel(surveyResponse, freeformFeedback)
    }

    window.churnkey.init('show', config)
  }

  return {
    isConfigured,
    show
  }
}
