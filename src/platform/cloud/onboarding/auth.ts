import * as Sentry from '@sentry/vue'
import { isEmpty } from 'es-toolkit/compat'

import { api } from '@/scripts/api'
import { toError } from '@/utils/errorUtil'

interface UserCloudStatus {
  status: 'active'
}

const ONBOARDING_SURVEY_KEY = 'onboarding_survey'

/**
 * Thrown when /settings/{key} returns 401/403. Callers can branch on
 * `error instanceof SurveyAuthError` instead of pattern-matching error
 * messages — see router.ts and CloudSurveyView.vue for the consumers.
 */
export class SurveyAuthError extends Error {
  readonly status: number
  constructor(status: number, statusText: string) {
    super(`Survey status auth error: ${status} ${statusText}`)
    this.name = 'SurveyAuthError'
    this.status = status
  }
}

/**
 * Helper function to capture API errors with Sentry
 */
function captureApiError(
  error: Error,
  endpoint: string,
  errorType: 'http_error' | 'network_error',
  httpStatus?: number,
  operation?: string,
  extraContext?: Record<string, unknown>
) {
  const tags: Record<string, string | number> = {
    api_endpoint: endpoint,
    error_type: errorType
  }

  if (httpStatus !== undefined) {
    tags.http_status = httpStatus
  }

  if (operation) {
    tags.operation = operation
  }

  const sentryOptions: Sentry.ExclusiveEventHintOrCaptureContext = {
    tags,
    extra: extraContext ? { ...extraContext } : undefined
  }

  Sentry.captureException(error, sentryOptions)
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

/**
 * Returns whether the user has completed the onboarding survey.
 *
 * Resolution rules (prefer false negatives over false positives — i.e. rather
 * miss a survey prompt than redirect a working customer to /cloud/survey):
 *   - 200 with non-empty `value`           → true  (definitely completed)
 *   - 200 with empty `value`               → false (definitely not completed)
 *   - 404                                  → true  (key absent; could be a
 *       genuinely new user OR a customer whose Settings JSON pre-dates the
 *       survey. We can't distinguish on the wire and prefer the safer default.
 *       New users still get the survey via the onboarding signup flow itself.)
 *   - 401 / 403                            → throws (auth issue, not a survey
 *       signal — propagate so the auth layer handles it)
 *   - 5xx / network error                  → true  (backend hiccup — don't
 *       bounce the user on a transient blip)
 */
export async function getSurveyCompletedStatus(): Promise<boolean> {
  try {
    const response = await api.fetchApi(`/settings/${ONBOARDING_SURVEY_KEY}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      // 200: definitive signal. Empty value = never completed.
      return !isEmpty(data.value)
    }

    if (response.status === 401 || response.status === 403) {
      // Auth failure - propagate so the auth layer can handle. Returning
      // false here would let an expired token masquerade as "no survey" and
      // bounce the user to /cloud/survey on every transient 401.
      throw new SurveyAuthError(response.status, response.statusText)
    }

    // 404 / 5xx / other: ambiguous. Treat as completed to avoid false
    // positives — rather miss a survey than bounce a paying customer.
    return true
  } catch (error) {
    // Re-throw auth errors so callers can branch on them; everything else
    // (network failure, parse failure, etc) is treated as "completed".
    if (error instanceof SurveyAuthError) {
      throw error
    }
    return true
  }
}

export async function submitSurvey(
  survey: Record<string, unknown>
): Promise<void> {
  try {
    Sentry.addBreadcrumb({
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
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Survey submitted successfully',
      level: 'info'
    })
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
