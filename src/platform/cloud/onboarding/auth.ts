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

  // A transient failure reads as completed rather than bouncing a working user
  // to /cloud/survey.
  return (await readStoredSurvey()) !== 'absent'
}

/**
 * `unknown` is kept distinct from `absent` because the two callers need
 * opposite fallbacks: the gate may treat "don't know" as completed and let a
 * working user through, but a decision about whether to overwrite the answers
 * may not, since guessing wrong either destroys them or discards the pass.
 */
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
    // 404 = the survey key was never stored = genuinely not completed. Only
    // reachable after a successful authenticated read (a stale token returns
    // 401, never 404), so it can't be a transient-auth false signal.
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
  // A replay exercises the flow rather than re-profiling the user, so it keeps
  // the answers already on the account: submitting is the only way out of the
  // survey, and this POST would replace them wholesale. With nothing stored to
  // preserve there is nothing to decline, so the pass is the account's real
  // first one and is written normally.
  //
  // Read before spending the request, and refuse to guess: writing over
  // answers that might be there would destroy them, and skipping a write that
  // was needed would discard the pass silently.
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

    // Spent only now: a replay that failed to write has not been served, and
    // must still be able to reach the survey on a retry.
    if (replaying) consumeSurveyReplayRequest()

    // Log successful survey submission
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
