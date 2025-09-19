import * as Sentry from '@sentry/vue'
import { isEmpty } from 'es-toolkit/compat'

import { api } from '@/scripts/api'

export interface UserCloudStatus {
  status: 'active' | 'waitlisted'
}

const ONBOARDING_SURVEY_KEY = 'onboarding_survey'

/**
 * Helper function to capture API errors with Sentry
 */
function captureApiError(
  error: Error,
  endpoint: string,
  errorType: 'http_error' | 'network_error',
  httpStatus?: number,
  operation?: string,
  extraContext?: Record<string, any>
) {
  const tags: Record<string, any> = {
    api_endpoint: endpoint,
    error_type: errorType
  }

  if (httpStatus !== undefined) {
    tags.http_status = httpStatus
  }

  if (operation) {
    tags.operation = operation
  }

  const sentryOptions: any = {
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
      captureApiError(error as Error, '/user', 'network_error')
    }
    throw error
  }
}

export async function getInviteCodeStatus(
  inviteCode: string
): Promise<{ claimed: boolean; expired: boolean }> {
  try {
    const response = await api.fetchApi(
      `/invite_code/${encodeURIComponent(inviteCode)}/status`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
    if (!response.ok) {
      const error = new Error(
        `Failed to get invite code status: ${response.statusText}`
      )
      captureApiError(
        error,
        '/invite_code/{code}/status',
        'http_error',
        response.status,
        undefined,
        {
          api: {
            method: 'GET',
            endpoint: `/invite_code/${inviteCode}/status`,
            status_code: response.status,
            status_text: response.statusText
          },
          extra: {
            invite_code_length: inviteCode.length
          },
          route_template: '/invite_code/{code}/status',
          route_actual: `/invite_code/${inviteCode}/status`
        }
      )
      throw error
    }

    return response.json()
  } catch (error) {
    // Only capture network errors (not HTTP errors we already captured)
    if (!isHttpError(error, 'Failed to get invite code status:')) {
      captureApiError(
        error as Error,
        '/invite_code/{code}/status',
        'network_error',
        undefined,
        undefined,
        {
          route_template: '/invite_code/{code}/status',
          route_actual: `/invite_code/${inviteCode}/status`
        }
      )
    }
    throw error
  }
}

export async function getSurveyCompletedStatus(): Promise<boolean> {
  try {
    const response = await api.fetchApi(`/settings/${ONBOARDING_SURVEY_KEY}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    if (!response.ok) {
      // Not an error case - survey not completed is a valid state
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Survey status check returned non-ok response',
        level: 'info',
        data: {
          status: response.status,
          endpoint: `/settings/${ONBOARDING_SURVEY_KEY}`
        }
      })
      return false
    }
    const data = await response.json()
    // Check if data exists and is not empty
    return !isEmpty(data.value)
  } catch (error) {
    // Network error - still capture it as it's not thrown from above
    Sentry.captureException(error, {
      tags: {
        api_endpoint: '/settings/{key}',
        error_type: 'network_error'
      },
      extra: {
        route_template: '/settings/{key}',
        route_actual: `/settings/${ONBOARDING_SURVEY_KEY}`
      },
      level: 'warning'
    })
    return false
  }
}

export async function postSurveyStatus(): Promise<void> {
  try {
    const response = await api.fetchApi(`/settings/${ONBOARDING_SURVEY_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ [ONBOARDING_SURVEY_KEY]: undefined })
    })

    if (!response.ok) {
      const error = new Error(
        `Failed to post survey status: ${response.statusText}`
      )
      captureApiError(
        error,
        '/settings/{key}',
        'http_error',
        response.status,
        'post_survey_status',
        {
          route_template: '/settings/{key}',
          route_actual: `/settings/${ONBOARDING_SURVEY_KEY}`
        }
      )
      throw error
    }
  } catch (error) {
    // Only capture network errors (not HTTP errors we already captured)
    if (!isHttpError(error, 'Failed to post survey status:')) {
      captureApiError(
        error as Error,
        '/settings/{key}',
        'network_error',
        undefined,
        'post_survey_status',
        {
          route_template: '/settings/{key}',
          route_actual: `/settings/${ONBOARDING_SURVEY_KEY}`
        }
      )
    }
    throw error
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
        error as Error,
        '/settings',
        'network_error',
        undefined,
        'submit_survey'
      )
    }
    throw error
  }
}

export async function claimInvite(
  code: string
): Promise<Promise<{ success: boolean; message: string }>> {
  try {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Attempting to claim invite',
      level: 'info',
      data: {
        code_length: code.length
      }
    })

    const res = await api.fetchApi(
      `/invite_code/${encodeURIComponent(code)}/claim`,
      {
        method: 'POST'
      }
    )

    if (!res.ok) {
      const error = new Error(
        `Failed to claim invite: ${res.status} ${res.statusText}`
      )
      captureApiError(
        error,
        '/invite_code/{code}/claim',
        'http_error',
        res.status,
        'claim_invite',
        {
          invite: {
            code_length: code.length,
            status_code: res.status,
            status_text: res.statusText
          },
          route_template: '/invite_code/{code}/claim',
          route_actual: `/invite_code/${encodeURIComponent(code)}/claim`
        }
      )
      throw error
    }

    // Log successful invite claim
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Invite claimed successfully',
      level: 'info'
    })

    return res.json()
  } catch (error) {
    // Only capture network errors (not HTTP errors we already captured)
    if (!isHttpError(error, 'Failed to claim invite:')) {
      captureApiError(
        error as Error,
        '/invite_code/{code}/claim',
        'network_error',
        undefined,
        'claim_invite',
        {
          route_template: '/invite_code/{code}/claim',
          route_actual: `/invite_code/${encodeURIComponent(code)}/claim`
        }
      )
    }
    throw error
  }
}
