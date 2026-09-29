import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import HeroSection from './HeroSection.vue'

const stubs = {
  VideoPlayer: {
    props: {
      src: String,
      poster: String,
      ariaLabel: String,
      autoplay: Boolean,
      loop: Boolean
    },
    template:
      '<div data-testid="video-player" :data-src="src" :data-poster="poster" :data-aria-label="ariaLabel" :data-autoplay="autoplay" :data-loop="loop" />'
  },
  GlassCard: { template: '<div><slot /></div>' }
}

describe('HeroSection', () => {
  it('autoplays the recruiting video looped with its poster', () => {
    render(HeroSection, { global: { stubs } })

    const player = screen.getByTestId('video-player')

    expect(player.dataset.src).toBe(
      'https://media.comfy.org/website/careers/recruiting-v03.mp4'
    )
    expect(player.dataset.poster).toBe(
      'https://media.comfy.org/website/careers/recruiting-v03-poster.webp'
    )
    expect(player.dataset.autoplay).toBe('true')
    expect(player.dataset.loop).toBe('true')
  })

  it('labels the player in the page locale', () => {
    render(HeroSection, { props: { locale: 'zh-CN' }, global: { stubs } })

    expect(screen.getByTestId('video-player').dataset.ariaLabel).toBe(
      t('careers.hero.videoLabel', 'zh-CN')
    )
  })
})
