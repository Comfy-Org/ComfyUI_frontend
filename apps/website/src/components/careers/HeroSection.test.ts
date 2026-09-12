// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import HeroSection from './HeroSection.vue'

describe('careers HeroSection', () => {
  it('renders the showcase video with a localized accessible label', () => {
    render(HeroSection)

    const video = screen.getByLabelText(
      'Showcase reel of AI imagery and video generated with ComfyUI'
    )
    expect(video.tagName).toBe('VIDEO')
    expect(video.getAttribute('src')).toBe(
      'https://media.comfy.org/website/careers/hero-1280.mp4'
    )
    expect(video.hasAttribute('loop')).toBe(true)
  })

  it('localizes the video label for zh-CN', () => {
    render(HeroSection, { props: { locale: 'zh-CN' } })

    expect(
      screen.getByLabelText('ComfyUI 生成的 AI 图像与视频精选合集')
    ).toBeTruthy()
  })
})
