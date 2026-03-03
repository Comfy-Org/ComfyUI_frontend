import * as Sentry from '@sentry/vue'
import { isEmpty } from 'es-toolkit/compat'

import { api } from '@/scripts/api'

interface UserCloudStatus {
  status: 'active'
}

const ONBOARDING_SURVEY_KEY = 'onboarding_survey'

async function fetchApiWithSentry(
  endpoint: string,
  init: RequestInit,
  operation?: string
): Promise<Response> {
  try {
    const response = await api.fetchApi(endpoint, init)
    if (!response.ok) {
      const error = new Error(
        `API ${init.method} ${endpoint} failed: ${response.statusText}`
      )
      Sentry.captureException(error, {
        tags: {
          api_endpoint: endpoint,
          error_type: 'http_error',
          http_status: response.status,
          ...(operation && { operation })
        }
      })
      throw error
    }
    return response
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('API ')) {
      Sentry.captureException(error, {
        tags: {
          api_endpoint: endpoint,
          error_type: 'network_error',
          ...(operation && { operation })
        }
      })
    }
    throw error
  }
}

export async function getUserCloudStatus(): Promise<UserCloudStatus> {
  const response = await fetchApiWithSentry('/user', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  return response.json()
}

export async function getSurveyCompletedStatus(): Promise<boolean> {
  try {
    const response = await api.fetchApi(`/settings/${ONBOARDING_SURVEY_KEY}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) return false
    const data = await response.json()
    return !isEmpty(data.value)
  } catch (error) {
    Sentry.captureException(error, {
      tags: { api_endpoint: '/settings/{key}', error_type: 'network_error' },
      level: 'warning'
    })
    return false
  }
}

export async function submitSurvey(
  survey: Record<string, unknown>
): Promise<void> {
  await fetchApiWithSentry(
    '/settings',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [ONBOARDING_SURVEY_KEY]: survey })
    },
    'submit_survey'
  )
}
