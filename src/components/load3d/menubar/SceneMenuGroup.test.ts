import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SceneMenuGroup from '@/components/load3d/menubar/SceneMenuGroup.vue'
import type { SceneConfig } from '@/extensions/core/load3d/interfaces'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function makeConfig(overrides: Partial<SceneConfig> = {}): SceneConfig {
  return {
    showGrid: true,
    backgroundColor: '#000000',
    backgroundImage: '',
    backgroundRenderMode: 'tiled',
    ...overrides
  }
}

type Props = {
  config?: SceneConfig
  fov?: number
  hdriActive?: boolean
  canUseBackgroundImage?: boolean
  onUpdateBackgroundImage?: (file: File | null) => void
}

function renderGroup(props: Props = {}) {
  const result = render(SceneMenuGroup, {
    props: { config: makeConfig(), ...props },
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  return { ...result, user: userEvent.setup() }
}

describe('SceneMenuGroup', () => {
  it('toggles showGrid on the bound config', async () => {
    const config = makeConfig({ showGrid: true })
    const { user } = renderGroup({ config })

    await user.click(screen.getByRole('button', { name: 'Show grid' }))

    expect(config.showGrid).toBe(false)
  })

  it('hides background color and image controls while HDRI is active', () => {
    renderGroup({ hdriActive: true })

    expect(
      screen.queryByRole('button', { name: 'BG Color' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'BG Image' })
    ).not.toBeInTheDocument()
  })

  it('hides the image upload when background images are not allowed', () => {
    renderGroup({ canUseBackgroundImage: false })

    expect(screen.getByRole('button', { name: 'BG Color' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'BG Image' })
    ).not.toBeInTheDocument()
  })

  it('shows panorama and remove once a background image exists', async () => {
    const onUpdateBackgroundImage = vi.fn()
    const { user } = renderGroup({
      config: makeConfig({ backgroundImage: 'bg.png' }),
      onUpdateBackgroundImage
    })

    expect(screen.getByRole('button', { name: 'Panorama' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove BG' }))

    expect(onUpdateBackgroundImage).toHaveBeenCalledWith(null)
  })

  it('exposes the FOV control while a panorama background is active', () => {
    renderGroup({
      config: makeConfig({
        backgroundImage: 'bg.png',
        backgroundRenderMode: 'panorama'
      }),
      fov: 75
    })

    expect(screen.getByRole('button', { name: 'FOV' })).toBeInTheDocument()
  })

  it('clears the file input so the same image can be re-picked', async () => {
    const onUpdateBackgroundImage = vi.fn()
    const { user } = renderGroup({ onUpdateBackgroundImage })
    const input = screen.getByTestId<HTMLInputElement>('scene-bg-image-input')
    const file = new File(['x'], 'bg.png', { type: 'image/png' })

    await user.upload(input, file)

    expect(onUpdateBackgroundImage).toHaveBeenCalledWith(file)
    expect(input.value).toBe('')
  })
})
