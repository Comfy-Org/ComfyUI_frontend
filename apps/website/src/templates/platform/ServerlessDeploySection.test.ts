// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessDeploySection from './ServerlessDeploySection.vue'

const transcript = () => screen.getByRole('tabpanel').textContent

describe('ServerlessDeploySection', () => {
  it('walks through the install flow first and the workflow flow on demand', async () => {
    render(ServerlessDeploySection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: t('platform.serverlessDeploy.shipHeading', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getByText(
        /Easily package up your existing ComfyUI environment or a single workflow,\s+then deploy it to Comfy API\./
      )
    ).toBeTruthy()
    expect(transcript()).toContain('$ comfy build init\n')
    expect(transcript()).toContain(
      '$ comfy build push --release --target linux/nvidia'
    )

    await userEvent.click(
      screen.getByRole('tab', {
        name: t('platform.serverlessDeploy.tabWorkflow', 'en')
      })
    )

    expect(transcript()).toContain(
      '$ comfy build init --from-workflow ./workflow.json'
    )
    expect(transcript()).toContain(
      '$ comfy build push --release --target linux/nvidia'
    )
  })
})
