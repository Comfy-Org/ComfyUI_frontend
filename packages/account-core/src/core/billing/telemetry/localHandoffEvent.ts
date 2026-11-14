export type LocalHandoffSurface = 'local_web' | 'desktop'

export type LocalHandoffLaunchResult =
  | 'opened'
  | 'superseded'
  | 'sign_in_again'
  | 'refused'

export type LocalHandoffBillingEvent = {
  operation: 'local_handoff'
  stage: 'launched'
  outcome: 'pending' | 'failed'
  surface: LocalHandoffSurface
  result: LocalHandoffLaunchResult
  error_code?: string
}
