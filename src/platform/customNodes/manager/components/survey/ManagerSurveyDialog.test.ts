import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import en from '@/locales/en/main.json'
import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'

vi.mock(import('@/composables/auth/useCurrentUser'))

import ManagerSurveyDialog from '@/platform/customNodes/manager/components/survey/ManagerSurveyDialog.vue'

const SURVEY_URL = 'https://us.posthog.com/external_surveys/survey-123'

function renderDialog(onClose = vi.fn()) {
  return render(ManagerSurveyDialog, {
    props: { onClose },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
}

describe('ManagerSurveyDialog', () => {
  it('embeds the configured survey URL with the logged-in user', () => {
    useRemoteConfigStore().acceptConfig(
      { manager_survey_url: SURVEY_URL },
      false
    )
    useCurrentUser().resolvedUserInfo = computed(() => ({ id: 'user-123' }))

    renderDialog()

    const src = new URL(
      screen.getByTestId('manager-survey-iframe').getAttribute('src')!
    )
    expect(src.origin + src.pathname).toBe(SURVEY_URL)
    expect(src.searchParams.has('embed')).toBe(false)
    expect(src.searchParams.get('distinct_id')).toBe('user-123')
  })

  it('omits distinct_id when there is no logged-in user', () => {
    useRemoteConfigStore().acceptConfig(
      { manager_survey_url: SURVEY_URL },
      false
    )

    renderDialog()

    const src = new URL(
      screen.getByTestId('manager-survey-iframe').getAttribute('src')!
    )
    expect(src.searchParams.has('distinct_id')).toBe(false)
  })

  it('shows the error state when no survey url is configured', () => {
    renderDialog()

    expect(screen.queryByTestId('manager-survey-iframe')).toBeNull()
    expect(screen.getByTestId('manager-survey-error')).toBeTruthy()
  })

  it('shows the error state when the configured survey url is malformed', () => {
    useRemoteConfigStore().acceptConfig(
      { manager_survey_url: 'not a valid url' },
      false
    )

    renderDialog()

    expect(screen.queryByTestId('manager-survey-iframe')).toBeNull()
    expect(screen.getByTestId('manager-survey-error')).toBeTruthy()
  })

  it('recovers from the error state when the survey url arrives after mount', async () => {
    renderDialog()
    expect(screen.getByTestId('manager-survey-error')).toBeTruthy()

    useRemoteConfigStore().acceptConfig(
      { manager_survey_url: SURVEY_URL },
      false
    )
    await nextTick()

    expect(screen.queryByTestId('manager-survey-error')).toBeNull()
    expect(screen.getByTestId('manager-survey-iframe')).toBeTruthy()
  })

  it('clears the loading state once the iframe loads', async () => {
    useRemoteConfigStore().acceptConfig(
      { manager_survey_url: SURVEY_URL },
      false
    )

    renderDialog()
    expect(screen.getByTestId('manager-survey-loading')).toBeTruthy()

    await screen
      .getByTestId('manager-survey-iframe')
      .dispatchEvent(new Event('load'))

    expect(screen.queryByTestId('manager-survey-loading')).toBeNull()
  })

  it('applies survey height messages even when the url has a trailing slash', async () => {
    useRemoteConfigStore().acceptConfig(
      {
        manager_survey_url:
          'https://us.posthog.com/external_surveys/survey-123/'
      },
      false
    )

    renderDialog()
    const iframe = screen.getByTestId('manager-survey-iframe')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://us.posthog.com',
        data: {
          type: 'posthog:survey:height',
          surveyId: 'survey-123',
          height: 800
        }
      })
    )
    await nextTick()

    expect(iframe.getAttribute('style')).toContain('height: 800px')
  })

  it('removes the iframe and shows the error state when loading times out', async () => {
    useRemoteConfigStore().acceptConfig(
      { manager_survey_url: SURVEY_URL },
      false
    )

    renderDialog()
    expect(screen.getByTestId('manager-survey-iframe')).toBeTruthy()

    await vi.advanceTimersByTimeAsync(8000)
    await nextTick()

    expect(screen.queryByTestId('manager-survey-iframe')).toBeNull()
    expect(screen.getByTestId('manager-survey-error')).toBeTruthy()
  })

  it('closes the dialog when the close button is clicked', async () => {
    const onClose = vi.fn()
    useRemoteConfigStore().acceptConfig(
      { manager_survey_url: SURVEY_URL },
      false
    )
    renderDialog(onClose)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
