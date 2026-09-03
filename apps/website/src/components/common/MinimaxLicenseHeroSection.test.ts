// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import MinimaxLicenseHeroSection from './MinimaxLicenseHeroSection.vue'

const happyWindow = window as typeof window & {
  happyDOM: { setViewport: (viewport: { width: number }) => void }
}

function renderHero(locale: 'en' | 'zh-CN' = 'en') {
  return render(MinimaxLicenseHeroSection, {
    props: { locale }
  })
}

beforeEach(() => {
  happyWindow.happyDOM.setViewport({ width: 1280 })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
})

describe('MinimaxLicenseHeroSection', () => {
  it('promotes the license without a coming-soon label', () => {
    renderHero()

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /MiniMax\s+Commercial License/
      })
    ).toBeTruthy()
    expect(screen.queryByText('COMING SOON')).toBeNull()
    expect(screen.getByText('Only official reseller')).toBeTruthy()
  })

  it('links to the license request and H3 cloud workflow', () => {
    renderHero()

    expect(
      screen.getByRole('link', { name: 'REQUEST LICENSE' }).getAttribute('href')
    ).toBe('/contact')
    expect(
      screen
        .getByRole('link', { name: 'TRY H3 ON COMFY CLOUD' })
        .getAttribute('href')
    ).toBe('https://cloud.comfy.org/?share=a781503cf508')
  })

  it('localizes the embedded hero', () => {
    renderHero('zh-CN')

    expect(
      screen.getByRole('heading', { level: 2, name: 'MiniMax 商业许可' })
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: '申请许可' }).getAttribute('href')
    ).toBe('/zh-CN/contact')
  })

  it('renders the CDN video with persistent mute controls', async () => {
    renderHero()

    await nextTick()

    const video = screen.getByLabelText(/MiniMax\s+Commercial License/)
    expect(video.getAttribute('src')).toBe(
      'https://media.comfy.org/website/minimax/commercial-license.mp4'
    )
    expect(video.getAttribute('poster')).toBe(
      'https://media.comfy.org/website/minimax/commercial-license-poster.jpg'
    )
    expect(video).toHaveProperty('autoplay', true)
    expect(video).toHaveProperty('loop', true)
    expect(screen.getByRole('button', { name: /^(Play|Pause)$/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^(Mute|Unmute)$/ })).toBeTruthy()
    expect(screen.queryByRole('slider', { name: 'Seek' })).toBeNull()
  })
})
