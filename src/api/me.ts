// Mock API for user onboarding status
// TODO: Replace with actual API calls when backend is ready

export interface UserOnboardingStatus {
  surveyTaken: boolean
  whitelisted: boolean
  email?: string
  userId?: string
}

export async function getMe(): Promise<UserOnboardingStatus | null> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  // Check localStorage for mock onboarding status
  // These values are null if not set (user hasn't completed the step)
  const surveyCompleted = localStorage.getItem('surveyCompleted')
  const whitelisted = localStorage.getItem('whitelisted')
  const userEmail = localStorage.getItem('userEmail')

  // Return user status
  // If key doesn't exist (null), treat as false
  return {
    surveyTaken: surveyCompleted === 'true',
    whitelisted: whitelisted === 'true',
    email: userEmail || undefined,
    userId: userEmail || undefined
  }
}

// Helper function to update mock data (for testing)
export function setMockUserData(data: Partial<UserOnboardingStatus>) {
  if (data.surveyTaken !== undefined) {
    localStorage.setItem('surveyCompleted', data.surveyTaken ? 'true' : 'false')
  }
  if (data.whitelisted !== undefined) {
    localStorage.setItem('whitelisted', data.whitelisted ? 'true' : 'false')
  }
}
