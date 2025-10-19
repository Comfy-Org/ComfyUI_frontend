import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the distribution check
vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

describe('useTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null when not in cloud distribution', async () => {
    const { useTelemetry } = await import('@/platform/telemetry')
    const provider = useTelemetry()

    // Should return null for OSS builds
    expect(provider).toBeNull()
  })

  it('should return null consistently for OSS builds', async () => {
    const { useTelemetry } = await import('@/platform/telemetry')

    const provider1 = useTelemetry()
    const provider2 = useTelemetry()

    // Both should be null for OSS builds
    expect(provider1).toBeNull()
    expect(provider2).toBeNull()
  })

  it('should have correct TelemetryEvents constants', async () => {
    const { TelemetryEvents } = await import('@/platform/telemetry/types')

    expect(TelemetryEvents.USER_SIGN_UP_OPENED).toBe('user_sign_up_opened')
    expect(TelemetryEvents.USER_SIGN_UP_COMPLETED).toBe(
      'user_sign_up_completed'
    )
    expect(TelemetryEvents.RUN_BUTTON_CLICKED).toBe('run_button_clicked')
    expect(TelemetryEvents.SUBSCRIPTION_REQUIRED_MODAL_OPENED).toBe(
      'subscription_required_modal_opened'
    )
    expect(TelemetryEvents.SUBSCRIBE_NOW_BUTTON_CLICKED).toBe(
      'subscribe_now_button_clicked'
    )
    expect(TelemetryEvents.USER_SURVEY_OPENED).toBe('user_survey_opened')
    expect(TelemetryEvents.USER_SURVEY_SUBMITTED).toBe('user_survey_submitted')
    expect(TelemetryEvents.USER_EMAIL_VERIFY_OPENED).toBe(
      'user_email_verify_opened'
    )
    expect(TelemetryEvents.USER_EMAIL_VERIFY_REQUESTED).toBe(
      'user_email_verify_requested'
    )
    expect(TelemetryEvents.USER_EMAIL_VERIFY_COMPLETED).toBe(
      'user_email_verify_completed'
    )
    expect(TelemetryEvents.TEMPLATE_WORKFLOW_OPENED).toBe(
      'template_workflow_opened'
    )
  })
})
