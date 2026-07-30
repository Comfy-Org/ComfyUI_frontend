import { beforeEach, describe, expect, it, vi } from 'vitest'

import { openTypeformDialog } from '@/platform/surveys/openTypeformDialog'
import { useTelemetry } from '@/platform/telemetry'

import { FEEDBACK_TYPEFORM_ID } from './config'
import { openFeedbackDialog } from './feedbackDialog'

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/surveys/openTypeformDialog', () => ({
  openTypeformDialog: vi.fn()
}))

const trackUiButtonClicked = vi.fn()
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({ trackUiButtonClicked }))
}))

const userEmail = vi.hoisted((): { value: string | undefined } => ({
  value: undefined
}))
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ userEmail })
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true,
  isNightly: false
}))

describe('openFeedbackDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userEmail.value = undefined
  })

  it('opens the feedback form tagged with distribution and source', () => {
    openFeedbackDialog('action-bar')

    expect(openTypeformDialog).toHaveBeenCalledWith({
      key: 'global-feedback',
      typeformId: FEEDBACK_TYPEFORM_ID,
      title: 'feedback.title',
      hiddenFields: 'distribution=ccloud,source=action-bar'
    })
  })

  it('includes the logged-in user email as a hidden field', () => {
    userEmail.value = 'user@example.com'

    openFeedbackDialog('action-bar')

    expect(openTypeformDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        hiddenFields:
          'distribution=ccloud,source=action-bar,email=user@example.com'
      })
    )
  })

  it('tracks the button click tagged with the opening source', () => {
    openFeedbackDialog('topbar')

    expect(trackUiButtonClicked).toHaveBeenCalledWith({
      button_id: 'feedback_button_clicked',
      element_group: 'topbar'
    })
  })

  it('does not throw when telemetry is unavailable', () => {
    vi.mocked(useTelemetry).mockReturnValueOnce(null)

    expect(() => openFeedbackDialog('action-bar')).not.toThrow()
    expect(openTypeformDialog).toHaveBeenCalled()
  })
})
