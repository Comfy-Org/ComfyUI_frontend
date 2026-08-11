import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

const mocks = vi.hoisted(
  () =>
    ({
      remoteConfig: { value: {} },
      resolvedUserInfo: { value: null }
    }) as {
      remoteConfig: { value: RemoteConfig }
      resolvedUserInfo: { value: { id: string } | null }
    }
)

vi.mock('@/platform/remoteConfig/remoteConfig', async () => {
  const { ref } = await import('vue')
  mocks.remoteConfig = ref<RemoteConfig>({})
  return { remoteConfig: mocks.remoteConfig }
})

vi.mock('@/composables/auth/useCurrentUser', async () => {
  const { ref } = await import('vue')
  mocks.resolvedUserInfo = ref<{ id: string } | null>(null)
  return {
    useCurrentUser: () => ({ resolvedUserInfo: mocks.resolvedUserInfo })
  }
})

import ManagerSurveyDialog from '@/workbench/extensions/manager/components/survey/ManagerSurveyDialog.vue'

const SURVEY_URL = 'https://us.posthog.com/external_surveys/survey-123'

function renderDialog(onClose = vi.fn()) {
  return render(ManagerSurveyDialog, {
    props: { onClose },
    global: { mocks: { $t: (key: string) => key } }
  })
}

describe('ManagerSurveyDialog', () => {
  beforeEach(() => {
    mocks.remoteConfig.value = {}
    mocks.resolvedUserInfo.value = null
  })

  it('embeds the configured survey URL with the logged-in user', () => {
    mocks.remoteConfig.value = { manager_survey_url: SURVEY_URL }
    mocks.resolvedUserInfo.value = { id: 'user-123' }

    renderDialog()

    const src = new URL(
      screen.getByTestId('manager-survey-iframe').getAttribute('src')!
    )
    expect(src.origin + src.pathname).toBe(SURVEY_URL)
    expect(src.searchParams.has('embed')).toBe(false)
    expect(src.searchParams.get('distinct_id')).toBe('user-123')
  })

  it('omits distinct_id when there is no logged-in user', () => {
    mocks.remoteConfig.value = { manager_survey_url: SURVEY_URL }

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
    mocks.remoteConfig.value = { manager_survey_url: 'not a valid url' }

    renderDialog()

    expect(screen.queryByTestId('manager-survey-iframe')).toBeNull()
    expect(screen.getByTestId('manager-survey-error')).toBeTruthy()
  })

  it('recovers from the error state when the survey url arrives after mount', async () => {
    renderDialog()
    expect(screen.getByTestId('manager-survey-error')).toBeTruthy()

    mocks.remoteConfig.value = { manager_survey_url: SURVEY_URL }
    await nextTick()

    expect(screen.queryByTestId('manager-survey-error')).toBeNull()
    expect(screen.getByTestId('manager-survey-iframe')).toBeTruthy()
  })

  it('clears the loading state once the iframe loads', async () => {
    mocks.remoteConfig.value = { manager_survey_url: SURVEY_URL }

    renderDialog()
    expect(screen.getByTestId('manager-survey-loading')).toBeTruthy()

    await screen
      .getByTestId('manager-survey-iframe')
      .dispatchEvent(new Event('load'))

    expect(screen.queryByTestId('manager-survey-loading')).toBeNull()
  })

  it('applies survey height messages even when the url has a trailing slash', async () => {
    mocks.remoteConfig.value = {
      manager_survey_url: 'https://us.posthog.com/external_surveys/survey-123/'
    }

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
    vi.useFakeTimers()
    try {
      mocks.remoteConfig.value = { manager_survey_url: SURVEY_URL }

      renderDialog()
      expect(screen.getByTestId('manager-survey-iframe')).toBeTruthy()

      await vi.advanceTimersByTimeAsync(8000)
      await nextTick()

      expect(screen.queryByTestId('manager-survey-iframe')).toBeNull()
      expect(screen.getByTestId('manager-survey-error')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('closes the dialog when the close button is clicked', async () => {
    const onClose = vi.fn()
    mocks.remoteConfig.value = { manager_survey_url: SURVEY_URL }
    renderDialog(onClose)

    await userEvent.click(screen.getByRole('button', { name: 'g.close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
