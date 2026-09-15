// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import TeamPhotosSection from './TeamPhotosSection.vue'

const altTexts = () =>
  screen.getAllByRole('img').map((img) => img.getAttribute('alt'))

/**
 * Alt text is the copy nobody sees, which is exactly why it gets left in
 * English: a page can look fully translated in review while every image still
 * describes itself to a screen reader in the wrong language.
 */
describe('TeamPhotosSection', () => {
  it('describes each photo in the reader’s language', () => {
    render(TeamPhotosSection, { props: { locale: 'zh-CN' } })

    expect(altTexts()).toContain('团队聚餐')
  })

  it('describes them in Japanese for a Japanese reader', () => {
    render(TeamPhotosSection, { props: { locale: 'ja' } })

    expect(altTexts()).toContain('チームディナー')
  })

  it('leaves nothing without a description', () => {
    render(TeamPhotosSection, { props: { locale: 'en' } })

    const texts = altTexts()
    expect(texts.length).toBeGreaterThan(0)
    expect(texts.filter((alt) => !alt?.trim())).toEqual([])
  })
})
