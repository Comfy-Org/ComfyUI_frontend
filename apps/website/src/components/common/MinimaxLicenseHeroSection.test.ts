// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import MinimaxLicenseHeroSection from './MinimaxLicenseHeroSection.vue'

function renderHero(locale: 'en' | 'zh-CN' = 'en') {
  return render(MinimaxLicenseHeroSection, {
    props: { locale },
    global: { stubs: { VideoPlayer: true } }
  })
}

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
    ).toBe('https://comfy.org/contact')
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
    expect(screen.getByRole('link', { name: '申请许可' })).toBeTruthy()
  })
})
