import type {
  InAppSurveyEvent,
  InAppSurveyStage
} from '@/platform/telemetry/types'

export const CANCELLATION_REASONS = [
  'tooExpensive',
  'notUsingEnough',
  'missingFeatures',
  'switchingTools',
  'somethingElse'
] as const

export type CancellationReason = (typeof CANCELLATION_REASONS)[number]

export type CancellationSurveyExit =
  | 'continue_cancelling'
  | 'keep_plan'
  | 'closed'

export interface CancellationSurveyAnswers {
  reason?: CancellationReason
  comment: string
}

const REASON_QUESTION_ID = 'f5b2934c-a2aa-4e9d-83d2-bbb346b2a196'
const COMMENT_QUESTION_ID = '3a3166fb-c479-439b-8c8a-65dde9f2147a'

const REASON_CHOICES: Record<CancellationReason, string> = {
  tooExpensive: 'Too expensive',
  notUsingEnough: 'Not using it enough',
  missingFeatures: 'Missing features or models',
  switchingTools: 'Switching to another tool',
  somethingElse: 'Something else'
}

function surveyResponses({
  reason,
  comment
}: CancellationSurveyAnswers): Record<string, string> {
  const responses: Record<string, string> = {}
  if (reason) responses[REASON_QUESTION_ID] = REASON_CHOICES[reason]
  const trimmedComment = comment.trim()
  if (trimmedComment) responses[COMMENT_QUESTION_ID] = trimmedComment
  return responses
}

function experimentProperties(
  experimentVariant: string | undefined
): Record<string, string> {
  return experimentVariant ? { experiment_variant: experimentVariant } : {}
}

export function cancellationSurveyShownEvent(options: {
  surveyId: string
  experimentVariant?: string
}): InAppSurveyEvent {
  return {
    surveyId: options.surveyId,
    properties: experimentProperties(options.experimentVariant)
  }
}

export function cancellationSurveyExitEvent(options: {
  surveyId: string
  answers: CancellationSurveyAnswers
  exit: CancellationSurveyExit
  experimentVariant?: string
}): { stage: InAppSurveyStage; event: InAppSurveyEvent } {
  const responses = surveyResponses(options.answers)
  const properties = {
    outcome: options.exit,
    ...experimentProperties(options.experimentVariant)
  }
  if (Object.keys(responses).length === 0)
    return {
      stage: 'dismissed',
      event: { surveyId: options.surveyId, properties }
    }
  return {
    stage: 'sent',
    event: { surveyId: options.surveyId, responses, properties }
  }
}
