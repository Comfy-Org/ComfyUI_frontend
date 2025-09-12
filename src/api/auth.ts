// Mock API for authentication and user onboarding
// TODO: Replace with actual API calls when backend is ready

// ============ Types ============
export interface UserOnboardingStatus {
  surveyCompleted: boolean
  whitelisted: boolean
}

export interface InviteStatus {
  emailVerified: boolean
  alreadyClaimed: boolean
}

export function getMe(): UserOnboardingStatus {
  const surveyCompleted = localStorage.getItem('surveyCompleted')
  const whitelisted = localStorage.getItem('whitelisted')

  return {
    surveyCompleted: surveyCompleted === 'true',
    whitelisted: whitelisted === 'true'
  }
}

export function getInviteStatus(): InviteStatus {
  const emailVerified = localStorage.getItem('emailVerified')
  const alreadyClaimed = localStorage.getItem('alreadyClaimed')

  return {
    emailVerified: emailVerified === 'true',
    alreadyClaimed: alreadyClaimed === 'true'
  }
}

export function verifyEmail(): void {
  localStorage.setItem('emailVerified', 'true')
}

export function completeSurvey(): void {
  localStorage.setItem('surveyCompleted', 'true')
}
