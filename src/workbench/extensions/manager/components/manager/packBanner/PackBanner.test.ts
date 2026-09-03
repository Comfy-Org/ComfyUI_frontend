import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { components } from '@/types/comfyRegistryTypes'

import PackBanner from './PackBanner.vue'

const DEFAULT_BANNER = '/assets/images/fallback-gradient-avatar.svg'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        defaultBanner: 'Default banner'
      }
    }
  }
})

function makePack(
  overrides: Partial<components['schemas']['Node']> = {}
): components['schemas']['Node'] {
  return {
    id: 'pack-id',
    name: 'TestPack',
    ...overrides
  } as components['schemas']['Node']
}

function renderPackBanner(nodePack: components['schemas']['Node']) {
  return render(PackBanner, {
    props: { nodePack },
    global: { plugins: [i18n] }
  })
}

describe('PackBanner', () => {
  it('renders the default banner when both banner_url and icon are missing', () => {
    renderPackBanner(makePack())
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', DEFAULT_BANNER)
    expect(img).toHaveAttribute('alt', 'Default banner')
  })

  it('renders the banner_url image when provided', () => {
    renderPackBanner(makePack({ banner_url: 'https://example.com/banner.png' }))
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/banner.png')
    expect(img).toHaveAttribute('alt', 'TestPack banner')
  })

  it('falls back to icon when banner_url is missing but icon is set', () => {
    renderPackBanner(makePack({ icon: 'https://example.com/icon.svg' }))
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/icon.svg'
    )
  })

  it('falls back to default banner when image fails to load', async () => {
    renderPackBanner(makePack({ banner_url: 'https://example.com/broken.png' }))
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/broken.png'
    )

    await fireEvent.error(screen.getByRole('img'))

    expect(screen.getByRole('img')).toHaveAttribute('src', DEFAULT_BANNER)
  })
})
