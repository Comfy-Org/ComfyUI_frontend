// Mock API for survey submission
// TODO: Replace with actual API calls when backend is ready

import { setMockUserData } from './me'

export interface SurveyPayload {
  useCase?: string
  experience?: string
  teamSize?: string
  [key: string]: any
}

export interface SurveyResponse {
  whitelisted: boolean
  message?: string
}

export async function submitSurvey(_payload: SurveyPayload): Promise<SurveyResponse> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Mock logic: whitelist some users based on payload
  // In production, this would be determined by backend
  const isWhitelisted = Math.random() > 0.5 // 50% chance for demo
  
  // Update mock user data
  setMockUserData({
    surveyTaken: true,
    whitelisted: isWhitelisted
  })
  
  return {
    whitelisted: isWhitelisted,
    message: isWhitelisted 
      ? 'Welcome! You have been granted access.' 
      : 'Thank you! You have been added to the waitlist.'
  }
}