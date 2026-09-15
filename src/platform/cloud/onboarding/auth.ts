import { addBreadcrumb } from '@sentry/vue'
import { isEmpty } from 'es-toolkit/compat'

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

/**
 * Helper function to check if error is already handled HTTP error
 */
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
    // Only capture network errors (not HTTP errors we already captured)
    if (!isHttpError(error, 'Failed to get user:')) {
      captureApiError(toError(error), '/user', 'network_error')
    }
    throw error
  }
}

export async function getSurveyCompletedStatus(): Promise<boolean> {
  // A replay re-opens the gate here rather than by clearing the stored answers,
  // which `/api/settings` could only overwrite, never restore.
  if (isSurveyReplayRequested()) return false

  return hasStoredSurvey()
}

async function hasStoredSurvey(): Promise<boolean> {
  try {
    const response = await api.fetchApi(`/settings/${ONBOARDING_SURVEY_KEY}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    // 404 = the survey key was never stored = genuinely not completed. Only
    // reachable after a successful authenticated read (a stale token returns
    // 401, never 404), so it can't be a transient-auth false signal.
    if (response.status === 404) {
      return false
    }
    if (!response.ok) {
      // Other non-ok (401/403/5xx): treat as completed so a transient failure
      // never bounces a working user to /cloud/survey.
      addBreadcrumb({
        category: 'auth',
        message: 'Survey status check returned non-ok response',
        level: 'warning',
        data: {
          status: response.status,
          endpoint: `/settings/${ONBOARDING_SURVEY_KEY}`
        }
      })
      return true
    }
    const data = await response.json()
    return !isEmpty(data.value)
  } catch (error) {
    // Network/parse failure: same fail-safe policy as a non-ok response.
    reportError(error, {
      errorType: 'network_error',
      tags: { api_endpoint: '/settings/{key}' },
      context: {
        route_template: '/settings/{key}',
        route_actual: `/settings/${ONBOARDING_SURVEY_KEY}`
      },
      level: 'warning'
    })
    return true
  }
}

/** Whether the answers were stored, which a replayed pass declines to do. */
export async function submitSurvey(
  survey: Record<string, unknown>
): Promise<boolean> {
  // A replay exercises the flow rather than re-profiling the user, so it keeps
  // the answers already on the account: submitting is the only way out of the
  // survey, and this POST would replace them wholesale. With nothing stored to
  // preserve there is nothing to decline, and dropping the write would lose
  // the pass and bounce the user back to the form.
  if (isSurveyReplayRequested()) {
    consumeSurveyReplayRequest()
    if (await hasStoredSurvey()) return false
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
      throw error
    }

    // Log successful survey submission
    addBreadcrumb({
      category: 'auth',
      message: 'Survey submitted successfully',
      level: 'info'
    })

    return true
  } catch (error) {
    // Only capture network errors (not HTTP errors we already captured)
    if (!isHttpError(error, 'Failed to submit survey:')) {
      captureApiError(
        toError(error),
        '/settings',
        'network_error',
        undefined,
        'submit_survey'
      )
    }
    throw error
  }
}
