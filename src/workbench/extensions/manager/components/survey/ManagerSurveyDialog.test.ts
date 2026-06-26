import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

const remoteConfig = vi.hoisted(() => ({ value: {} as RemoteConfig }))
const resolvedUserInfo = vi.hoisted(
  () => ({ value: null }) as { value: { id: string } | null }
)

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ resolvedUserInfo })
}))

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
    remoteConfig.value = {}
    resolvedUserInfo.value = null
  })

  it('embeds the configured survey URL linked to the logged-in user', () => {
    remoteConfig.value = { manager_survey_url: SURVEY_URL }
    resolvedUserInfo.value = { id: 'user-123' }

    renderDialog()

    const src = new URL(
      screen.getByTestId('manager-survey-iframe').getAttribute('src')!
    )
    expect(src.origin + src.pathname).toBe(SURVEY_URL)
    expect(src.searchParams.get('distinct_id')).toBe('user-123')
  })

  it('omits distinct_id when there is no logged-in user', () => {
    remoteConfig.value = { manager_survey_url: SURVEY_URL }

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
    remoteConfig.value = { manager_survey_url: 'not a valid url' }

    renderDialog()

    expect(screen.queryByTestId('manager-survey-iframe')).toBeNull()
    expect(screen.getByTestId('manager-survey-error')).toBeTruthy()
  })

  it('clears the loading state once the iframe loads', async () => {
    remoteConfig.value = { manager_survey_url: SURVEY_URL }

    renderDialog()
    expect(screen.getByTestId('manager-survey-loading')).toBeTruthy()

    await screen
      .getByTestId('manager-survey-iframe')
      .dispatchEvent(new Event('load'))

    expect(screen.queryByTestId('manager-survey-loading')).toBeNull()
  })

  it('closes the dialog when the close button is clicked', async () => {
    const onClose = vi.fn()
    remoteConfig.value = { manager_survey_url: SURVEY_URL }
    renderDialog(onClose)

    await userEvent.click(screen.getByRole('button', { name: 'g.close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
