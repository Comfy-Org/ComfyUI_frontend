import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Slots } from 'vue'
import { computed, h, inject, nextTick, provide } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import LinkReleaseNodeSubmenu from './LinkReleaseNodeSubmenu.vue'
import type { LinkReleaseNodeCategory } from './linkReleaseMenuModel'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

const category: LinkReleaseNodeCategory = {
  key: 'comfy',
  labelKey: 'Comfy Nodes',
  icon: 'icon-[lucide--box]',
  nodes: [{ name: 'KSampler', display_name: 'KSampler' } as ComfyNodeDefImpl]
}

const SUB_OPEN = Symbol('subOpen')

const stubs = {
  DropdownMenuSub: {
    props: ['open'],
    setup(props: { open?: boolean }, { slots }: { slots: Slots }) {
      provide(
        SUB_OPEN,
        computed(() => props.open ?? false)
      )
      return () => h('div', slots.default?.())
    }
  },
  DropdownMenuSubTrigger: {
    template: '<button data-testid="sub-trigger"><slot /></button>'
  },
  DropdownMenuPortal: { template: '<div><slot /></div>' },
  DropdownMenuSubContent: {
    setup(_: unknown, { slots }: { slots: Slots }) {
      const open = inject<{ value: boolean }>(SUB_OPEN)
      return () =>
        open?.value ? h('div', { role: 'menu' }, slots.default?.()) : null
    }
  },
  DropdownMenuSeparator: { template: '<hr />' },
  DropdownMenuItem: {
    template: '<div role="menuitem" tabindex="-1"><slot /></div>'
  },
  MiddleTruncate: { template: '<span>{{ text }}</span>', props: ['text'] }
}

function renderSubmenu() {
  return render(LinkReleaseNodeSubmenu, {
    props: { category, itemClass: '', contentClass: '', scrollClass: '' },
    global: { plugins: [i18n], stubs }
  })
}

describe('LinkReleaseNodeSubmenu keyboard handling', () => {
  it('steps into the submenu search on ArrowRight', async () => {
    renderSubmenu()
    await userEvent.click(screen.getByTestId('sub-trigger'))
    await userEvent.keyboard('{ArrowRight}')
    await nextTick()

    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('steps into the submenu search on Enter', async () => {
    renderSubmenu()
    await userEvent.click(screen.getByTestId('sub-trigger'))
    await userEvent.keyboard('{Enter}')
    await nextTick()

    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('does not move focus to the search on other keys', async () => {
    renderSubmenu()
    await userEvent.click(screen.getByTestId('sub-trigger'))
    await userEvent.keyboard('a')
    await nextTick()

    expect(screen.getByRole('textbox')).not.toHaveFocus()
  })

  async function stepIntoSearch() {
    await userEvent.click(screen.getByTestId('sub-trigger'))
    await userEvent.keyboard('{ArrowRight}')
    await nextTick()
  }

  it('selects the first filtered node on Enter in the search', async () => {
    const onSelect = vi.fn()
    render(LinkReleaseNodeSubmenu, {
      props: { category, itemClass: '', contentClass: '', scrollClass: '', onSelect },
      global: { plugins: [i18n], stubs }
    })
    await stepIntoSearch()
    expect(screen.getByRole('textbox')).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(category.nodes[0])
  })

  it('does not select on Escape in the search', async () => {
    const onSelect = vi.fn()
    render(LinkReleaseNodeSubmenu, {
      props: { category, itemClass: '', contentClass: '', scrollClass: '', onSelect },
      global: { plugins: [i18n], stubs }
    })
    await stepIntoSearch()

    await userEvent.keyboard('{Escape}')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('moves focus to the first node on ArrowDown from the search', async () => {
    renderSubmenu()
    await stepIntoSearch()

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem')).toHaveFocus()
  })
})
