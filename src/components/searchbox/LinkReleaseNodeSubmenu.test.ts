import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
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

const stubs = {
  DropdownMenuSub: { template: '<div><slot /></div>' },
  DropdownMenuSubTrigger: {
    template: '<button data-testid="sub-trigger"><slot /></button>'
  },
  DropdownMenuPortal: { template: '<div><slot /></div>' },
  DropdownMenuSubContent: { template: '<div role="menu"><slot /></div>' },
  DropdownMenuSeparator: { template: '<hr />' },
  DropdownMenuItem: { template: '<div role="menuitem"><slot /></div>' },
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
})
