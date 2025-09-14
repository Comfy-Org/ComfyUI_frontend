import { isEmpty } from 'es-toolkit/compat'

import { api } from '@/scripts/api'

export interface UserCloudStatus {
  status: 'active' | 'waitlisted'
}

const ONBOARDING_SURVEY_KEY = 'onboarding_survey'

export async function getUserCloudStatus(): Promise<UserCloudStatus> {
  const response = await api.fetchApi('/user', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  if (!response.ok) {
    throw new Error(`Failed to get user: ${response.statusText}`)
  }

  return response.json()
}

export async function getInviteCodeStatus(
  inviteCode: string
): Promise<{ expired: boolean }> {
  const response = await api.fetchApi(
    `/invite/${encodeURIComponent(inviteCode)}/status`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )
  if (!response.ok) {
    throw new Error(`Failed to get invite code status: ${response.statusText}`)
  }

  return response.json()
}

export async function getSurveyCompletedStatus(): Promise<boolean> {
  const response = await api.fetchApi(`/settings/${ONBOARDING_SURVEY_KEY}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  if (!response.ok) {
    return false
  }
  const data = await response.json()
  // Check if data exists and is not empty
  return !isEmpty(data.value)
}

export async function postSurveyStatus(): Promise<void> {
  await api.fetchApi(`/settings/${ONBOARDING_SURVEY_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ [ONBOARDING_SURVEY_KEY]: undefined })
  })
}

export async function submitSurvey(
  survey: Record<string, unknown>
): Promise<void> {
  const response = await api.fetchApi('/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ [ONBOARDING_SURVEY_KEY]: survey })
  })
  if (!response.ok) {
    throw new Error(`Failed to submit survey: ${response.statusText}`)
  }
}

export async function claimInvite(code: string): Promise<void> {
  const res = await api.fetchApi(`/invite/${encodeURIComponent(code)}/claim`, {
    method: 'POST'
  })
  if (!res.ok) {
    throw new Error(`Failed to claim invite: ${res.status} ${res.statusText}`)
  }
}
