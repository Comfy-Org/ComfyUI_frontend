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
  it.for<Item & { arrow: boolean }>([
    { arrow: false },
    { external: true, arrow: true },
    { newTab: true, arrow: false }
  ])(
    'shows the arrow on a text link only when external: $arrow (external $external, newTab $newTab)',
    ({ arrow, ...item }) => {
      renderLink(item)

      expect(screen.queryByTestId('external-link-arrow') !== null).toBe(arrow)
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
