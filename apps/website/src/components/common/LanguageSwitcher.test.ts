import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { Locale } from '@/i18n/translations'
import type { LocaleAlternate } from '@/lib/hreflang'
import LanguageSwitcher from './LanguageSwitcher.vue'

const home: LocaleAlternate[] = [
  { locale: 'en', path: '/' },
  { locale: 'zh-CN', path: '/zh-CN/' },
  { locale: 'ja', path: '/ja/' }
]

describe('LanguageSwitcher', () => {
  it('links each published language by its own name', () => {
    render(LanguageSwitcher, { props: { locale: 'en', alternates: home } })

    expect(
      screen.getAllByRole('link').map((link) => ({
        name: link.textContent.trim(),
        href: link.getAttribute('href'),
        lang: link.getAttribute('lang'),
        hreflang: link.getAttribute('hreflang')
      }))
    ).toEqual([
      { name: 'English', href: '/', lang: 'en', hreflang: 'en' },
      { name: '简体中文', href: '/zh-CN/', lang: 'zh-CN', hreflang: 'zh-CN' },
      { name: '日本語', href: '/ja/', lang: 'ja', hreflang: 'ja' }
    ])
  })

  it('marks the language being read as the current page', () => {
    render(LanguageSwitcher, { props: { locale: 'zh-CN', alternates: home } })

    expect(
      screen.getByRole('link', { current: 'page' }).textContent.trim()
    ).toBe('简体中文')
  })

  it.for([
    { locale: 'en', label: 'Language' },
    { locale: 'zh-CN', label: '语言' }
  ] satisfies { locale: Locale; label: string }[])(
    'labels the switcher $label for a $locale reader',
    ({ locale, label }) => {
      render(LanguageSwitcher, { props: { locale, alternates: home } })

      expect(
        screen.getByRole('navigation', { name: label })
      ).toBeInTheDocument()
    }
  )

  it.for([
    { name: 'no alternates', alternates: [] },
    { name: 'only itself', alternates: [{ locale: 'en', path: '/cli/' }] }
  ] satisfies { name: string; alternates: LocaleAlternate[] }[])(
    'renders nothing for a page with $name',
    ({ alternates }) => {
      render(LanguageSwitcher, { props: { locale: 'en', alternates } })

      expect(screen.queryByRole('navigation')).toBeNull()
    }
  )
})
