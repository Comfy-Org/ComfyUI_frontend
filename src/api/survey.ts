// Mock API for survey submission
// TODO: Replace with actual API calls when backend is ready
import { completeSurvey } from './auth'

export interface SurveyPayload {
  useCase?: string
  experience?: string
  teamSize?: string
  [key: string]: any
}

export interface SurveyResponse {
  success: boolean
  message?: string
}

export async function submitSurvey(
  _payload: SurveyPayload
): Promise<SurveyResponse> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Complete survey
  completeSurvey()

  return {
    success: true,
    message: 'Thank you! Your survey has been submitted.'
  }
}
