import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import LogoContextMenu from './LogoContextMenu.vue'

function servedIcon(file: string) {
  return readFileSync(
    join(import.meta.dirname, '../../../../public/icons', file),
    'utf8'
  )
}

async function openMenu(locale?: 'en' | 'zh-CN') {
  const visitor = userEvent.setup()
  render(LogoContextMenu, {
    props: { locale },
    slots: { default: '<a href="/" aria-label="Comfy home">Comfy</a>' }
  })
  await visitor.pointer({
    keys: '[MouseRight]',
    target: screen.getByRole('link', { name: 'Comfy home' })
  })
  await screen.findByRole('menu')
  return visitor
}

describe('LogoContextMenu', () => {
  it.for([
    { item: 'Copy logo as SVG', file: 'logo.svg' },
    { item: 'Copy logomark as SVG', file: 'logomark.svg' }
  ])(
    '"$item" puts the SVG served at /icons/$file on the clipboard and confirms it in place',
    async ({ item, file }) => {
      const visitor = await openMenu()

      await visitor.click(screen.getByRole('menuitem', { name: item }))

      expect(await navigator.clipboard.readText()).toBe(servedIcon(file))
      expect(
        await screen.findByRole('menuitem', { name: 'Copied' })
      ).toBeTruthy()
    }
  )

  it.for([
    { locale: 'en', href: '/brand', label: 'Brand assets' },
    { locale: 'zh-CN', href: '/zh-CN/brand', label: '品牌素材' }
  ] as const)(
    'links "$label" to the $locale brand page',
    async ({ locale, href, label }) => {
      await openMenu(locale)

      expect(screen.getByRole('menuitem', { name: label })).toHaveAttribute(
        'href',
        href
      )
    }
  )
})
