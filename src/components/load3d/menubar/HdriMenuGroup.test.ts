import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import HdriMenuGroup from '@/components/load3d/menubar/HdriMenuGroup.vue'
import type {
  HDRIConfig,
  LightConfig
} from '@/extensions/core/load3d/interfaces'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function makeConfig(hdri?: Partial<HDRIConfig>): LightConfig {
  return {
    intensity: 5,
    hdri: hdri
      ? {
          enabled: false,
          hdriPath: '',
          showAsBackground: false,
          intensity: 1,
          ...hdri
        }
      : undefined
  }
}

type Props = {
  config?: LightConfig
  sceneHasImage?: boolean
  onUpdateHdriFile?: (file: File | null) => void
}

function renderGroup(props: Props = {}) {
  const result = render(HdriMenuGroup, {
    props: { config: makeConfig({}), ...props },
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  return { ...result, user: userEvent.setup() }
}

describe('HdriMenuGroup', () => {
  it('shows the upload button when no HDRI is loaded', () => {
    renderGroup()

    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
  })

  it('hides the upload when a background image is set and no HDRI exists', () => {
    renderGroup({ config: makeConfig({ hdriPath: '' }), sceneHasImage: true })

    expect(
      screen.queryByRole('button', { name: 'Upload' })
    ).not.toBeInTheDocument()
  })

  it('toggles enabled and forwards removal once a file is loaded', async () => {
    const onUpdateHdriFile = vi.fn()
    const config = makeConfig({ hdriPath: 'env.hdr', enabled: false })
    const { user } = renderGroup({ config, onUpdateHdriFile })

    await user.click(screen.getByRole('button', { name: 'HDRI' }))
    expect(config.hdri?.enabled).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onUpdateHdriFile).toHaveBeenCalledWith(null)
  })
})
