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

export async function getSurveyStatus(): Promise<boolean> {
  const response = await api.fetchApi(
    `/settings?keys=${ONBOARDING_SURVEY_KEY}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )
  if (!response.ok) {
    return false
  }
  const json = await response.json()
  // The settings API returns an object with keys as requested
  return Object.prototype.hasOwnProperty.call(json, ONBOARDING_SURVEY_KEY)
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
