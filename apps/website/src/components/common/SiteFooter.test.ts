import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { externalLinks, getRoutes } from '@/config/routes'
import SiteFooter from './SiteFooter.vue'

describe('SiteFooter', () => {
  it.for([
    ['en', 'ComfyUI Models'],
    ['zh-CN', 'ComfyUI 模型'],
    ['ja', 'ComfyUI Models']
  ] as const)(
    'links the one model catalogue from every locale (%s)',
    ([locale, name]) => {
      render(SiteFooter, { props: { locale } })

      for (const link of screen.getAllByRole('link', { name })) {
        expect(link.getAttribute('href')).toBe(getRoutes().workshop)
      }
    }
  )

  it.for([
    ['en', 'Workflows', externalLinks.workflows],
    ['en', 'Use Cases', externalLinks.workflowUseCases],
    ['zh-CN', '工作流', externalLinks.workflows],
    ['zh-CN', '用例', 'https://comfy.org/workflows/use-cases/']
  ] as const)(
    'links the Comfy Workflows hub in the same tab (%s: %s)',
    ([locale, name, href]) => {
      render(SiteFooter, { props: { locale } })

      const links = screen.getAllByRole('link', { name })
      expect(links.length).toBeGreaterThan(0)
      for (const link of links) {
        expect(link.getAttribute('href')).toBe(href)
        expect(link.getAttribute('target')).toBeNull()
      }
    }
  )

  // The agent page gained a zh-CN twin, so the footer link has to follow the
  // active locale rather than staying pinned to the canonical /agent path.
  it.for([
    ['en', 'Comfy Agent', '/agent/'],
    ['zh-CN', 'Comfy Agent', '/zh-CN/agent/']
  ] as const)(
    'links the Comfy Agent page at its localized path (%s)',
    ([locale, name, href]) => {
      render(SiteFooter, { props: { locale } })

      const links = screen.getAllByRole('link', { name })
      expect(links.length).toBeGreaterThan(0)
      for (const link of links) {
        expect(link.getAttribute('href')).toBe(href)
      }
    }
  )

  it('links the MiniMax license page at its localized path for zh-CN', () => {
    render(SiteFooter, { props: { locale: 'zh-CN' } })

    const links = screen.getAllByRole('link', { name: 'MiniMax 商业许可' })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/zh-CN/minimax/license/')
    }
  })

  it.for(['en', 'zh-CN'] as const)(
    'links each social network as an icon button opening a new tab (%s)',
    (locale) => {
      render(SiteFooter, { props: { locale } })

      const social = within(
        screen.getByRole('navigation', {
          name: locale === 'en' ? 'Follow Comfy' : '关注 Comfy'
        })
      )
      expect(
        social.getAllByRole('link').map((link) => ({
          name: link.getAttribute('aria-label'),
          href: link.getAttribute('href'),
          target: link.getAttribute('target'),
          text: link.textContent.trim()
        }))
      ).toEqual(
        [
          ['GitHub', externalLinks.github],
          ['Discord', externalLinks.discord],
          ['X', externalLinks.x],
          ['YouTube', externalLinks.youtube],
          ['LinkedIn', externalLinks.linkedin],
          ['Instagram', externalLinks.instagram]
        ].map(([name, href]) => ({ name, href, target: '_blank', text: '' }))
      )
      expect(
        within(
          screen.getByRole('navigation', {
            name: locale === 'en' ? 'Resources' : '资源'
          })
        ).queryByRole('link', { name: /GitHub|Discord|YouTube/ })
      ).toBeNull()
    }
  )
})
