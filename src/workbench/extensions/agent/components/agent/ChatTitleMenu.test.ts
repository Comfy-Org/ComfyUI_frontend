import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'

import ChatTitleMenu from './ChatTitleMenu.vue'

function mount(props: ComponentProps<typeof ChatTitleMenu> = {}) {
  return render(ChatTitleMenu, {
    props: { title: 'Fox portrait', hasChat: true, ...props },
    global: { plugins: [i18n], directives: { tooltip: {} } }
  })
}

async function openMenu(): Promise<HTMLElement> {
  await userEvent.click(
    within(screen.getByRole('group', { name: 'Chat options' })).getByRole(
      'button',
      { name: 'Chat options' }
    )
  )
  return screen.getByRole('menu')
}

function entries(menu: HTMLElement): string[] {
  return within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent.trim())
}

describe('ChatTitleMenu', () => {
  it('names a chat that has no title yet and offers no menu for it', () => {
    mount({ title: undefined, hasChat: false })

    expect(screen.getByRole('button', { name: 'Untitled' })).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Chat options' })
    ).not.toBeInTheDocument()
  })

  it('renames the chat from its title', async () => {
    const view = mount()

    await userEvent.click(screen.getByRole('button', { name: 'Fox portrait' }))
    const input = screen.getByRole('textbox', { name: 'Rename' })
    await userEvent.clear(input)
    await userEvent.type(input, 'Snow fox{Enter}')

    expect(view.emitted().rename).toEqual([['Snow fox']])
    expect(screen.getByRole('button', { name: 'Fox portrait' })).toHaveFocus()
  })

  it.for([
    ['an unchanged title', '{Enter}'],
    ['a cancelled edit', ' v2{Escape}']
  ])('does not rename for %s', async ([, keys]) => {
    const view = mount()

    await userEvent.click(screen.getByRole('button', { name: 'Fox portrait' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Rename' }), keys)

    expect(view.emitted().rename).toBeUndefined()
    expect(screen.getByRole('button', { name: 'Fox portrait' })).toBeVisible()
  })

  it('offers rename and delete, without pinning, by default', async () => {
    const view = mount()
    const menu = await openMenu()

    expect(entries(menu)).toEqual(['Rename', 'Delete'])

    await userEvent.click(
      within(menu).getByRole('menuitem', { name: 'Delete' })
    )

    expect(view.emitted().delete).toHaveLength(1)
  })

  it.for([
    [false, 'Pin'],
    [true, 'Unpin']
  ] as const)(
    'offers to change the pin when pinned is %s',
    async ([pinned, label]) => {
      const view = mount({ canPin: true, pinned })
      const menu = await openMenu()

      expect(entries(menu)).toEqual([label, 'Rename', 'Delete'])

      await userEvent.click(within(menu).getByRole('menuitem', { name: label }))

      expect(view.emitted().togglePin).toHaveLength(1)
    }
  )
})
