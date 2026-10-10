import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import type { NavColumnItem } from '@/data/mainNavigation'
import NavLinkContent from './NavLinkContent.vue'

type Item = Pick<NavColumnItem, 'external' | 'newTab'>

function renderLink(item: Item & Pick<NavColumnItem, 'icon'>) {
  render({
    render: () =>
      h('a', { href: '/somewhere' }, [
        h(NavLinkContent, {
          item: { label: 'Re-shoot', ...item },
          locale: 'en'
        })
      ])
  })
  return screen.getByRole('link')
}

describe('NavLinkContent', () => {
  it.for<Item & { marked: boolean }>([
    { marked: false },
    { external: true, marked: true },
    { newTab: true, marked: true }
  ])(
    'marks a text link as opening a new tab: $marked (external $external, newTab $newTab)',
    ({ marked, ...item }) => {
      renderLink(item)

      expect(screen.queryByTestId('opens-in-new-tab') !== null).toBe(marked)
    }
  )

  it.for<Item & { name: string }>([
    { name: 'Re-shoot' },
    { external: true, name: 'Re-shoot (opens in new tab)' },
    { newTab: true, name: 'Re-shoot (opens in new tab)' }
  ])(
    'names an icon-only link $name (external $external, newTab $newTab)',
    ({ name, ...item }) => {
      expect(
        renderLink({ ...item, icon: '/icons/social/x.svg' })
      ).toHaveAccessibleName(name)
    }
  )
})
