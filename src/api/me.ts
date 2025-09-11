// Mock API for user onboarding status
// TODO: Replace with actual API calls when backend is ready

export interface UserOnboardingStatus {
  surveyTaken: boolean
  whitelisted: boolean
  email?: string
  userId?: string
}

// Mock data storage (in production, this would come from backend)
let mockUserData: UserOnboardingStatus = {
  surveyTaken: false,
  whitelisted: false
}

export async function getMe(): Promise<UserOnboardingStatus> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  // Return mock data
  return { ...mockUserData }
}

// Helper function to update mock data (for testing)
export function setMockUserData(data: Partial<UserOnboardingStatus>) {
  mockUserData = { ...mockUserData, ...data }
}
