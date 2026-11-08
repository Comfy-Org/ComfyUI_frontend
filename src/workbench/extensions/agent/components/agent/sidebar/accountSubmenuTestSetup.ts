import { render, screen } from '@testing-library/vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { vi } from 'vitest'
import type { Component } from 'vue'
import { defineComponent, h } from 'vue'

import { i18n } from '@/i18n'

export async function renderInOpenMenu(entry: Component): Promise<void> {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  render(
    defineComponent({
      setup: () => () =>
        h(DropdownMenuRoot, { defaultOpen: true }, () => [
          h(DropdownMenuTrigger),
          h(DropdownMenuPortal, () => h(DropdownMenuContent, () => h(entry)))
        ])
    }),
    { global: { plugins: [i18n] } }
  )
  await screen.findByRole('menu')
}
