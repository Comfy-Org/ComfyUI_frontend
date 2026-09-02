// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessDeploySection from './ServerlessDeploySection.vue'

const transcriptLines = () =>
  (screen.getByRole('tabpanel').textContent ?? '').split('\n')

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
    expect(transcriptLines()).toEqual([
      '$ comfy build init',
      '✔ Scanned this ComfyUI install — custom nodes, models, pinned deps',
      '$ comfy build push --release --target linux/nvidia',
      '✔ Build released',
      '$ comfy deploy up',
      '✔ Endpoint live → https://your-build.run.comfy.app'
    ])

    await userEvent.click(
      screen.getByRole('tab', {
        name: t('platform.serverlessDeploy.tabWorkflow', 'en')
      })
    )

    expect(transcriptLines()).toEqual([
      '$ comfy build init --from-workflow ./workflow.json --comfy-version v0.34.2',
      '✔ Custom nodes and models resolved from your workflow',
      '$ comfy build push --release --target linux/nvidia',
      '✔ Build released',
      '$ comfy deploy up',
      '✔ Endpoint live → https://your-build.run.comfy.app'
    ])
  })
})
