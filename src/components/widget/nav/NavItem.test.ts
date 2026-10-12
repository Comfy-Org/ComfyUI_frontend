import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import NavItem from './NavItem.vue'

describe('NavItem', () => {
  it('forwards attributes from the parent to the nav item', () => {
    render(NavItem, {
      props: { icon: 'icon-[lucide--keyboard]', onClick: () => {} },
      attrs: { 'data-nav-id': 'keybinding' },
      slots: { default: 'Keybinding' }
    })

    expect(screen.getByRole('button', { name: 'Keybinding' })).toHaveAttribute(
      'data-nav-id',
      'keybinding'
    )
  })
})
