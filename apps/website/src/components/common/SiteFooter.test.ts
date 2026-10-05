import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { externalLinks, getRoutes } from '@/config/routes'
import SiteFooter from './SiteFooter.vue'

describe('SiteFooter', () => {
  it.for([
    ['en', 'Changelog', 'Resources'],
    ['zh-CN', '更新日志', '资源'],
    ['ja', '変更履歴', 'Resources']
  ] as const)(
    'links the live changelog last in footer Resources (%s)',
    ([locale, name, resources]) => {
      render(SiteFooter, { props: { locale } })
      const links = screen.getAllByRole('link', { name })
      expect(links.map((link) => link.getAttribute('href'))).toEqual(
        Array(links.length).fill('/changelog/')
      )
      const columns = screen.getAllByRole('navigation', { name: resources })
      expect(
        columns.map((column) =>
          within(column).getAllByRole('link').at(-1)?.textContent.trim()
        )
      ).toEqual(Array(columns.length).fill(name))
      expect(getRoutes(locale).changelog).toBe('/changelog/')
    }
  )

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
})
