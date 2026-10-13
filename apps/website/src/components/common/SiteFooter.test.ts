import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { externalLinks, getRoutes } from '@/config/routes'
import type { LocaleAlternate } from '@/lib/hreflang'
import SiteFooter from './SiteFooter.vue'

const agentAlternates: LocaleAlternate[] = [
  { locale: 'en', path: '/agent/' },
  { locale: 'zh-CN', path: '/zh-CN/agent/' }
]

const socialChannels = [
  ['GitHub', externalLinks.github],
  ['Discord', externalLinks.discord],
  ['X', externalLinks.x],
  ['YouTube', externalLinks.youtube],
  ['LinkedIn', externalLinks.linkedin],
  ['Instagram', externalLinks.instagram]
] as const
const socialHrefs: readonly (string | null)[] = socialChannels.map(
  ([, href]) => href
)

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
      ['Supported Models', routes.models]
    ])
  })

  it.for([
    ['en', 'Follow Comfy', 'opens in new tab'],
    ['zh-CN', '关注 Comfy', '在新标签页中打开']
  ] as const)(
    'shows the social channels as icon links opening in a new tab (%s)',
    ([locale, name, newTab]) => {
      render(SiteFooter, { props: { locale } })

      const links = within(
        screen.getByRole('navigation', { name })
      ).getAllByRole('link')
      expect(
        links.map((link) => [
          link.textContent.replace(/\s+/g, ' ').trim(),
          link.getAttribute('href'),
          link.getAttribute('target'),
          link.getAttribute('rel')
        ])
      ).toEqual(
        socialChannels.map(([label, href]) => [
          `${label} (${newTab})`,
          href,
          '_blank',
          'noopener'
        ])
      )
    }
  )

  it('lists no social channel as a text link in Resources', () => {
    render(SiteFooter)

    const hrefs = within(screen.getByRole('navigation', { name: 'Resources' }))
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(hrefs.filter((href) => socialHrefs.includes(href))).toEqual([])
  })

  it('keeps Docs in Resources, opening in a new tab', () => {
    render(SiteFooter)

    const docs = within(
      screen.getByRole('navigation', { name: 'Resources' })
    ).getByRole('link', { name: 'Docs' })
    expect(docs.getAttribute('href')).toBe(externalLinks.docs)
    expect(docs.getAttribute('target')).toBe('_blank')
  })

  it('keeps Supported Models out of every column but Features', () => {
    render(SiteFooter)

    for (const column of ['Products', 'Models', 'Resources', 'Company']) {
      const nav = screen.getByRole('navigation', { name: column })
      expect(
        within(nav).queryByRole('link', { name: 'Supported Models' })
      ).toBeNull()
    }
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
