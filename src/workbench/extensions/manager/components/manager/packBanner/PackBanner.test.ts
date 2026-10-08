import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'

import PackBanner from './PackBanner.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const pack = { id: 'example-pack', name: 'Image Tools' }

describe('PackBanner', () => {
  it('generates artwork when banner and icon are absent or blank', () => {
    render(PackBanner, {
      props: { nodePack: { ...pack, banner_url: '  ', icon: '' } },
      global: { plugins: [i18n] }
    })
    expect(
      screen.getByRole('img', { name: 'Generated thumbnail for Image Tools' })
    ).toBeInTheDocument()
  })

  it('prioritizes a supplied banner over the icon', () => {
    render(PackBanner, {
      props: {
        nodePack: { ...pack, banner_url: '/banner.png', icon: '/icon.png' }
      },
      global: { plugins: [i18n] }
    })
    expect(screen.getByRole('img')).toHaveAttribute('src', '/banner.png')
  })

  it('uses the icon when no banner is supplied', () => {
    render(PackBanner, {
      props: { nodePack: { ...pack, icon: '/icon.png' } },
      global: { plugins: [i18n] }
    })
    expect(screen.getByRole('img')).toHaveAttribute('src', '/icon.png')
  })

  it('tries the icon after a broken banner, then generates artwork', async () => {
    render(PackBanner, {
      props: {
        nodePack: { ...pack, banner_url: '/banner.png', icon: '/icon.png' }
      },
      global: { plugins: [i18n] }
    })
    await fireEvent.error(screen.getByRole('img'))
    expect(screen.getByRole('img')).toHaveAttribute('src', '/icon.png')
    await fireEvent.error(screen.getByRole('img'))
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Generated thumbnail for Image Tools'
    )
    expect(screen.getByRole('img').tagName.toLowerCase()).toBe('svg')
  })

  it('does not retry the same broken URL supplied as both banner and icon', async () => {
    render(PackBanner, {
      props: {
        nodePack: { ...pack, banner_url: '/same.png', icon: '/same.png' }
      },
      global: { plugins: [i18n] }
    })
    await fireEvent.error(screen.getByRole('img'))
    expect(screen.getByRole('img').tagName.toLowerCase()).toBe('svg')
  })

  it('accepts new artwork after failure and ignores late errors from the old image', async () => {
    const { rerender } = render(PackBanner, {
      props: { nodePack: { ...pack, banner_url: '/old.png' } },
      global: { plugins: [i18n] }
    })
    const oldImage = screen.getByRole('img')
    await fireEvent.error(oldImage)
    await rerender({ nodePack: { ...pack, banner_url: '/new.png' } })
    await fireEvent.error(oldImage)
    expect(screen.getByRole('img')).toHaveAttribute('src', '/new.png')
  })

  it('updates generated artwork when a card is reused for another pack', async () => {
    const { rerender } = render(PackBanner, {
      props: { nodePack: pack },
      global: { plugins: [i18n] }
    })
    await rerender({ nodePack: { id: 'audio-pack', name: 'Audio Tools' } })
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Generated thumbnail for Audio Tools'
    )
    expect(screen.getByText('AT')).toBeInTheDocument()
  })
})
