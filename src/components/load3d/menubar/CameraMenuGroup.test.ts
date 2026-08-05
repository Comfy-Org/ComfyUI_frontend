import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import CameraMenuGroup from '@/components/load3d/menubar/CameraMenuGroup.vue'
import type { CameraConfig } from '@/extensions/core/load3d/interfaces'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function makeConfig(overrides: Partial<CameraConfig> = {}): CameraConfig {
  return { cameraType: 'perspective', fov: 75, ...overrides }
}

function renderGroup(config = makeConfig()) {
  const result = render(CameraMenuGroup, {
    props: { config },
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  return { ...result, user: userEvent.setup(), config }
}

describe('CameraMenuGroup', () => {
  it('switches the projection type', async () => {
    const { user, config } = renderGroup()

    await user.click(screen.getByRole('button', { name: 'Perspective' }))

    expect(config.cameraType).toBe('orthographic')
  })

  it('offers the FOV control only for a perspective camera', () => {
    renderGroup(makeConfig({ cameraType: 'orthographic' }))

    expect(
      screen.queryByRole('button', { name: 'FOV' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Orthographic' })
    ).toBeInTheDocument()
  })
})
