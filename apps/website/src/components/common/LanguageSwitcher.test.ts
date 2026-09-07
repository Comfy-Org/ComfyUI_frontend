// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import LanguageSwitcher from './LanguageSwitcher.vue'

const clustered = [
  { hreflang: 'en', href: 'https://comfy.org/download/' },
  { hreflang: 'zh-CN', href: 'https://comfy.org/zh-CN/download/' },
  { hreflang: 'ja', href: 'https://comfy.org/ja/download/' },
  { hreflang: 'x-default', href: 'https://comfy.org/download/' }
]

describe('LanguageSwitcher', () => {
  it('offers every language the page is published in', () => {
    render(LanguageSwitcher, { props: { locale: 'en', alternates: clustered } })

    for (const name of ['English', '简体中文', '日本語']) {
      expect(screen.getByRole('link', { name })).toBeTruthy()
    }
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  /**
   * `x-default` is a routing hint for crawlers, not a language. Rendering it
   * would put a fourth entry in the list that duplicates English.
   */
  it('never offers x-default as a language', () => {
    render(LanguageSwitcher, { props: { locale: 'en', alternates: clustered } })

    expect(screen.queryByRole('link', { name: 'x-default' })).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('links each language to that language of the same page', () => {
    render(LanguageSwitcher, { props: { locale: 'en', alternates: clustered } })

    expect(
      screen.getByRole('link', { name: '日本語' }).getAttribute('href')
    ).toBe('/ja/download/')
  })

  it('marks the language being read', () => {
    render(LanguageSwitcher, { props: { locale: 'ja', alternates: clustered } })

    // `current` is the role query for aria-current, so this asks the
    // accessibility tree the same question a screen reader would.
    expect(
      screen.getByRole('link', { name: '日本語', current: true })
    ).toBeTruthy()
    expect(
      screen.queryByRole('link', { name: 'English', current: true })
    ).toBeNull()
  })

  /**
   * A page outside a language cluster has nowhere to switch to. That is most of
   * the site — a held-back Japanese page, a locale-invariant legal document —
   * so the switcher has to disappear rather than render an empty control or,
   * worse, links to pages that are not published.
   */
  it('renders nothing for a page that is not published in another language', () => {
    render(LanguageSwitcher, { props: { locale: 'en', alternates: [] } })

    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('renders nothing when the only alternate is the page itself', () => {
    render(LanguageSwitcher, {
      props: {
        locale: 'en',
        alternates: [
          { hreflang: 'en', href: 'https://comfy.org/cli/' },
          { hreflang: 'x-default', href: 'https://comfy.org/cli/' }
        ]
      }
    })

    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
