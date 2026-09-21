import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ModelsHeroSection from './ModelsHeroSection.vue'

describe('ModelsHeroSection', () => {
  it.for([
    { locale: 'en', title: 'Flux in ComfyUI' },
    { locale: 'zh-CN', title: 'ComfyUI 中的 Flux' }
  ] as const)(
    'places the brand where the $locale title puts it',
    ({ locale, title }) => {
      render(ModelsHeroSection, {
        props: {
          locale,
          modelName: 'Flux',
          ctaHref: '/models',
          videoSrc: '/video.mp4'
        }
      })

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        new RegExp(`^${title}$`)
      )
    }
  )

  it('updates the title when its translation inputs change', async () => {
    const { rerender } = render(ModelsHeroSection, {
      props: {
        locale: 'en',
        modelName: 'Flux',
        ctaHref: '/models',
        videoSrc: '/video.mp4'
      }
    })

    await rerender({ locale: 'zh-CN', modelName: 'Wan' })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /^ComfyUI 中的 Wan$/
    )
  })
})
