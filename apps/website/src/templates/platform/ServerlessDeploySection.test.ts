// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessDeploySection from './ServerlessDeploySection.vue'

vi.mock('../../composables/useReducedMotion', () => ({
  prefersReducedMotion: () => true
}))

describe('ServerlessDeploySection', () => {
  it('presents the deploy transcript as a live terminal', () => {
    render(ServerlessDeploySection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: t('platform.serverlessDeploy.shipHeading', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.serverlessDeploy.shipSubtitle', 'en'))
    ).toBeTruthy()

    const terminal = screen.getByRole('img', {
      name: t('platform.serverlessDeploy.heading', 'en')
    })
    const transcript = terminal.textContent ?? ''
    for (const line of [
      '$ comfy build init',
      '✔ Scanned this ComfyUI install — custom nodes, models, pinned deps',
      '$ comfy build push --release --target linux/nvidia',
      '✔ Build released',
      '$ comfy deploy up',
      '✔ Endpoint live → https://your-build.run.comfy.app'
    ]) {
      expect(transcript).toContain(line)
    }
  })
})
