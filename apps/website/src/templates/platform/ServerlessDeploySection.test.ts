// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessDeploySection from './ServerlessDeploySection.vue'

describe('ServerlessDeploySection', () => {
  it('walks through the snapshot flow first and the workflow flow on demand', async () => {
    render(ServerlessDeploySection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.serverlessDeploy.heading', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: t('platform.serverlessDeploy.shipHeading', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.serverlessDeploy.shipSubtitle', 'en'))
    ).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(
      screen.getByText(t('platform.serverlessDeploy.2.title', 'en'))
    ).toBeTruthy()
    expect(screen.getByText(/comfy build init --from-snapshot/)).toBeTruthy()

    await userEvent.click(
      screen.getByRole('tab', {
        name: t('platform.serverlessDeploy.tabWorkflow', 'en')
      })
    )

    expect(screen.getByText(/comfy build init --from-workflow/)).toBeTruthy()
  })
})
