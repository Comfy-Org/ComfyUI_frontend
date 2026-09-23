import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { openTypeformDialog } from '@/platform/surveys/openTypeformDialog'
import { useTelemetry } from '@/platform/telemetry'

import { FEEDBACK_TYPEFORM_ID } from './config'
import { openFeedbackDialog } from './feedbackDialog'

vi.mock(import('@/i18n'))

vi.mock(import('@/platform/surveys/openTypeformDialog'), () => ({
  openTypeformDialog: vi.fn()
}))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/composables/auth/useCurrentUser'))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: true,
  isNightly: false
}))

describe('openFeedbackDialog', () => {
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
    useCurrentUser().userEmail = computed(() => 'user@example.com')

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

    expect(useTelemetry()?.trackUiButtonClicked).toHaveBeenCalledWith({
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
