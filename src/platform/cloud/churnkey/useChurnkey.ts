import { ref } from 'vue'

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

import type {
  ChurnkeyHandlerResult,
  ChurnkeyInitConfig,
  ChurnkeySessionResults
} from './types'

function readAppId(): string {
  return (import.meta.env.VITE_CHURNKEY_APP_ID ?? '') as string
}

interface ChurnkeyShowOptions {
  handleCancel: (
    surveyResponse: string,
    freeformFeedback?: string
  ) => Promise<ChurnkeyHandlerResult>
  onClose?: (results: ChurnkeySessionResults) => void
  onCancel?: (surveyResponse: string) => void
}

export function useChurnkey() {
  const isReady = ref(typeof window !== 'undefined' && !!window.churnkey?.init)
  const error = ref<string | null>(null)

  const isConfigured = !!readAppId()

  async function show(options: ChurnkeyShowOptions): Promise<void> {
    error.value = null

    const appId = readAppId()

    if (!appId) {
      throw new Error(
        'Churnkey is not configured (missing VITE_CHURNKEY_APP_ID)'
      )
    }

    if (typeof window === 'undefined' || !window.churnkey?.init) {
      throw new Error('Churnkey embed script has not loaded')
    }

    const auth = await workspaceApi.getChurnkeyAuth()

    const config: ChurnkeyInitConfig = {
      appId,
      authHash: auth.auth_hash,
      customerId: auth.customer_id,
      subscriptionId: auth.subscription_id,
      provider: 'stripe',
      mode: auth.mode,
      record: true,
      handleCancel: (_customer, surveyResponse, freeformFeedback) =>
        options.handleCancel(surveyResponse, freeformFeedback),
      onCancel: (_customer, surveyResponse) =>
        options.onCancel?.(surveyResponse),
      onClose: (results) => options.onClose?.(results)
    }

    window.churnkey.init('show', config as unknown as Record<string, unknown>)
    isReady.value = true
  }

  return {
    isConfigured,
    isReady,
    error,
    show
  }
}
