// @vitest-environment happy-dom
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { Locale } from '../../i18n/translations'

import SurfaceToggle from './SurfaceToggle.vue'

const cases: {
  locale: Locale
  active: 'mcp' | 'cli'
  activeName: string
  linkName: string
  href: string
}[] = [
  {
    locale: 'en',
    active: 'mcp',
    activeName: 'Comfy MCP',
    linkName: 'Comfy CLI',
    href: '/cli'
  },
  {
    locale: 'en',
    active: 'cli',
    activeName: 'Comfy CLI',
    linkName: 'Comfy MCP',
    href: '/mcp'
  },
  {
    locale: 'zh-CN',
    active: 'mcp',
    activeName: 'Comfy MCP',
    linkName: 'Comfy CLI',
    href: '/zh-CN/cli'
  },
  {
    locale: 'zh-CN',
    active: 'cli',
    activeName: 'Comfy CLI',
    linkName: 'Comfy MCP',
    href: '/zh-CN/mcp'
  }
]

describe('SurfaceToggle', () => {
  it.each(cases)(
    'marks $active current and links the other surface for $locale',
    ({ locale, active, activeName, linkName, href }) => {
      render(SurfaceToggle, { props: { locale, active } })

      const link = screen.getByRole('link', { name: new RegExp(linkName) })
      expect(link.getAttribute('href')).toBe(href)

      expect(
        screen.queryByRole('link', { name: new RegExp(activeName) })
      ).toBeNull()

      const activeSurface = screen.getByText(
        (_, element) => element?.getAttribute('aria-current') === 'page'
      )
      expect(within(activeSurface).getByText(activeName)).toBeTruthy()
    }
  )
})
