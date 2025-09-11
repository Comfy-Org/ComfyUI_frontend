// Simple mock auth using localStorage
export interface SimpleUser {
  emailVerified: boolean
  surveyCompleted: boolean
  whitelisted: boolean
}

export function getAuthStatus(): SimpleUser {
  const emailVerified = localStorage.getItem('emailVerified')
  const surveyCompleted = localStorage.getItem('surveyCompleted')
  const whitelisted = localStorage.getItem('whitelisted')

  return {
    emailVerified: emailVerified === null ? false : emailVerified === 'true',
    surveyCompleted:
      surveyCompleted === null ? false : surveyCompleted === 'true',
    whitelisted: whitelisted === null ? false : whitelisted === 'true'
  }
}

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
