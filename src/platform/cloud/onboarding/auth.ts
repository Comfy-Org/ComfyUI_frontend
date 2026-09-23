import { addBreadcrumb } from '@sentry/vue'

import {
  consumeSurveyReplayRequest,
  isSurveyReplayRequested
} from '@/platform/onboarding/onboardingReplay'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { toError } from '@/utils/errorUtil'

interface UserCloudStatus {
  status: 'active'
}

const ONBOARDING_SURVEY_KEY = 'onboarding_survey'

function captureApiError(
  error: Error,
  endpoint: string,
  errorType: 'http_error' | 'network_error',
  httpStatus?: number,
  operation?: string,
  extraContext?: Record<string, unknown>
) {
  reportError(error, {
    errorType,
    tags: {
      api_endpoint: endpoint,
      http_status: httpStatus,
      operation
    },
    context: extraContext
  })
}

function isHttpError(error: unknown, errorMessagePrefix: string): boolean {
  return error instanceof Error && error.message.startsWith(errorMessagePrefix)
}

export async function getUserCloudStatus(): Promise<UserCloudStatus> {
  try {
    const response = await api.fetchApi('/user', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    if (!response.ok) {
      const error = new Error(`Failed to get user: ${response.statusText}`)
      captureApiError(
        error,
        '/user',
        'http_error',
        response.status,
        undefined,
        {
          api: {
            method: 'GET',
            endpoint: '/user',
            status_code: response.status,
            status_text: response.statusText
          }
        }
      )
      throw error
    }

    return response.json()
  } catch (error) {
    if (!isHttpError(error, 'Failed to get user:')) {
      captureApiError(toError(error), '/user', 'network_error')
    }
    throw error
  }
}

export async function getSurveyCompletedStatus(): Promise<boolean> {
  if (isSurveyReplayRequested()) return false

  return (await readStoredSurvey()) !== 'absent'
}

type StoredSurvey = 'present' | 'absent' | 'unknown'

function classifyStoredSurvey(data: unknown): StoredSurvey {
  if (typeof data !== 'object' || data === null || !('value' in data)) {
    return 'unknown'
  }
  const value = data.value
  if (value === null) return 'absent'
  if (typeof value !== 'object' || Array.isArray(value)) return 'unknown'
  return Object.keys(value).length === 0 ? 'absent' : 'present'
}

async function readStoredSurvey(): Promise<StoredSurvey> {
  try {
    const response = await api.fetchApi(`/settings/${ONBOARDING_SURVEY_KEY}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    if (response.status === 404) {
      return 'absent'
    }
    if (!response.ok) {
      addBreadcrumb({
        category: 'auth',
        message: 'Survey status check returned non-ok response',
        level: 'warning',
        data: {
          status: response.status,
          endpoint: `/settings/${ONBOARDING_SURVEY_KEY}`
        }
      })
      return 'unknown'
    }
    const data: unknown = await response.json()
    return classifyStoredSurvey(data)
  } catch (error) {
    reportError(error, {
      errorType: 'network_error',
      tags: { api_endpoint: '/settings/{key}' },
      context: {
        route_template: '/settings/{key}',
        route_actual: `/settings/${ONBOARDING_SURVEY_KEY}`
      },
      level: 'warning'
    })
    return 'unknown'
  }
}

export type SurveySubmissionResult =
  | { status: 'stored' }
  | { status: 'preserved' }
  | { status: 'failed'; cause: unknown }

export async function submitSurvey(
  survey: Record<string, unknown>
): Promise<SurveySubmissionResult> {
  const replaying = isSurveyReplayRequested()
  if (replaying) {
    const stored = await readStoredSurvey()
    if (stored === 'unknown') {
      return {
        status: 'failed',
        cause:
          'Could not read the stored survey answers, so the replayed submission was not written'
      }
    }
    if (stored === 'present') {
      consumeSurveyReplayRequest()
      return { status: 'preserved' }
    }
  }

  try {
    addBreadcrumb({
      category: 'auth',
      message: 'Submitting survey',
      level: 'info',
      data: {
        survey_fields: Object.keys(survey)
      }
    })

    const response = await api.fetchApi('/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ [ONBOARDING_SURVEY_KEY]: survey })
    })

    if (!response.ok) {
      const error = new Error(`Failed to submit survey: ${response.statusText}`)
      captureApiError(
        error,
        '/settings',
        'http_error',
        response.status,
        'submit_survey',
        {
          survey: {
            field_count: Object.keys(survey).length,
            field_names: Object.keys(survey)
          }
        }
      )
      return { status: 'failed', cause: error }
    }

    if (replaying) consumeSurveyReplayRequest()

    addBreadcrumb({
      category: 'auth',
      message: 'Survey submitted successfully',
      level: 'info'
    })

    return { status: 'stored' }
  } catch (error) {
    captureApiError(
      toError(error),
      '/settings',
      'network_error',
      undefined,
      'submit_survey'
    )
    return { status: 'failed', cause: error }
  }
}
