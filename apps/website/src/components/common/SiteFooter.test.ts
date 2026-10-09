import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { externalLinks, getRoutes } from '@/config/routes'
import type { LocaleAlternate } from '@/lib/hreflang'
import SiteFooter from './SiteFooter.vue'

const agentAlternates: LocaleAlternate[] = [
  { locale: 'en', path: '/agent/' },
  { locale: 'zh-CN', path: '/zh-CN/agent/' }
]

describe('SiteFooter', () => {
  it.for([
    ['en', 'Changelog', 'Resources'],
    ['zh-CN', '更新日志', '资源'],
    ['ja', 'Changelog', 'Resources']
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
    }
  )

  it.for([
    ['en', 'ComfyUI Models'],
    ['zh-CN', 'ComfyUI 模型'],
    ['ja', 'ComfyUIのモデル']
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

  // The footer mirrors the top nav: same Products and Features columns, same
  // order, with Pricing kept at the end of Products.
  it('lists the nav Products and Features links in nav order (en)', () => {
    render(SiteFooter)
    const routes = getRoutes()

    const linksIn = (name: string) =>
      within(screen.getByRole('navigation', { name }))
        .getAllByRole('link')
        .map((link) => [link.textContent.trim(), link.getAttribute('href')])

    expect(linksIn('Products')).toEqual([
      ['Comfy Desktop', routes.download],
      ['Comfy Cloud', routes.cloud],
      ['Developer Platform', routes.platform],
      ['Comfy Router', routes.platformRouter],
      ['Comfy Enterprise', routes.enterprise],
      ['Managed Builds', routes.managedBuilds],
      ['Pricing', routes.pricing]
    ])
    expect(linksIn('Features')).toEqual([
      ['Comfy MCP', routes.mcp],
      ['Comfy Agent', routes.agent],
      ['Comfy CLI', routes.cli],
      ['Launches', routes.launches],
      ['Supported Models', routes.models]
    ])
  })

  it('keeps Docs in Resources, opening in a new tab', () => {
    render(SiteFooter)

    const docs = within(
      screen.getByRole('navigation', { name: 'Resources' })
    ).getByRole('link', { name: 'Docs' })
    expect(docs.getAttribute('href')).toBe(externalLinks.docs)
    expect(docs.getAttribute('target')).toBe('_blank')
  })

  it('lists Launches and Supported Models only in Features', () => {
    render(SiteFooter)

    for (const column of ['Products', 'Models', 'Resources', 'Company']) {
      const nav = screen.getByRole('navigation', { name: column })
      expect(within(nav).queryByRole('link', { name: 'Launches' })).toBeNull()
      expect(
        within(nav).queryByRole('link', { name: 'Supported Models' })
      ).toBeNull()
    }
    const features = screen.getByRole('navigation', { name: 'Features' })
    expect(
      within(features).getByRole('link', { name: 'Launches' })
    ).toBeTruthy()
    expect(
      within(features).getByRole('link', { name: 'Supported Models' })
    ).toBeTruthy()
  })

  it('hands the page alternates and the reader locale to the switcher', () => {
    render(SiteFooter, {
      props: { locale: 'zh-CN', alternates: agentAlternates }
    })

    expect(
      within(screen.getByRole('navigation', { name: '语言' }))
        .getAllByRole('link')
        .map((link) => [link.textContent.trim(), link.getAttribute('href')])
    ).toEqual([
      ['English', '/agent/'],
      ['简体中文', '/zh-CN/agent/']
    ])
  })
})
