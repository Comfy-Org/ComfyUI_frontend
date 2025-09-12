// Mock API for authentication and user onboarding
// TODO: Replace with actual API calls when backend is ready

// ============ Types ============
export interface UserOnboardingStatus {
  surveyCompleted: boolean
  whitelisted: boolean
  email?: string
}

export interface SimpleUser {
  emailVerified: boolean
  surveyCompleted: boolean
  whitelisted: boolean
}

// ============ User Status ============
export async function getMe(): Promise<UserOnboardingStatus | null> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  // Check localStorage for mock onboarding status
  const surveyCompleted = localStorage.getItem('surveyCompleted')
  const whitelisted = localStorage.getItem('whitelisted')
  const userEmail = localStorage.getItem('userEmail')

  // Return user status
  return {
    surveyCompleted: surveyCompleted === 'true',
    whitelisted: whitelisted === 'true',
    email: userEmail || undefined
  }
}

export function getAuthStatus(): SimpleUser {
  const emailVerified = localStorage.getItem('emailVerified')
  const surveyCompleted = localStorage.getItem('surveyCompleted')
  const whitelisted = localStorage.getItem('whitelisted')

  return {
    emailVerified: emailVerified === 'true',
    surveyCompleted: surveyCompleted === 'true',
    whitelisted: whitelisted === 'true'
  }
}

// ============ Auth Actions ============
export function verifyEmail(): void {
  localStorage.setItem('emailVerified', 'true')
}

export function completeSurvey(): void {
  localStorage.setItem('surveyCompleted', 'true')
}

export function claimInvite(code: string): boolean {
  const validCodes = ['test']
  if (validCodes.includes(code)) {
    localStorage.setItem('whitelisted', 'true')
    return true
  }
  return false
}

// ============ Mock Data Helpers ============
export function setMockUserData(data: Partial<UserOnboardingStatus>) {
  if (data.surveyCompleted !== undefined) {
    localStorage.setItem(
      'surveyCompleted',
      data.surveyCompleted ? 'true' : 'false'
    )
  }
  if (data.whitelisted !== undefined) {
    localStorage.setItem('whitelisted', data.whitelisted ? 'true' : 'false')
  }
}
