import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

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

    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.textContent.trim())).toEqual([
      'English',
      '简体中文',
      '日本語'
    ])
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/zh-CN/',
      '/ja/'
    ])
    expect(links.map((link) => link.getAttribute('lang'))).toEqual([
      'en',
      'zh-CN',
      'ja'
    ])
  })

  it('marks the language being read as the current page', () => {
    render(LanguageSwitcher, { props: { locale: 'zh-CN', alternates: home } })

    expect(
      screen.getByRole('link', { current: 'page' }).textContent.trim()
    ).toBe('简体中文')
  })

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
