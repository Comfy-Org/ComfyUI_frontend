import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'

import AgentSidebarNav from './AgentSidebarNav.vue'

function mount(props: Partial<ComponentProps<typeof AgentSidebarNav>> = {}) {
  return render(AgentSidebarNav, {
    props: { section: 'chats', ...props },
    global: { plugins: [i18n], directives: { tooltip: {} } }
  })
}

function currentDestinations(): (string | null)[] {
  return screen
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-current') === 'page')
    .map((button) => button.textContent)
}

describe('AgentSidebarNav', () => {
  it('lists chats, apps, workflows and templates in that order', () => {
    mount()
    const nav = screen.getByRole('navigation', { name: 'Agent sections' })

    expect(
      within(nav)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['Chats', 'Apps', 'Workflows', 'Templates'])
  })

  it.for([
    { section: 'chats', current: ['Chats'] },
    { section: 'apps', current: ['Apps'] },
    { section: 'workflows', current: ['Workflows'] }
  ] as const)(
    'marks only $section as the current section',
    ({ section, current }) => {
      mount({ section })

      expect(currentDestinations()).toEqual(current)
    }
  )

  it.for([
    { name: 'Chats', section: 'chats' },
    { name: 'Apps', section: 'apps' },
    { name: 'Workflows', section: 'workflows' }
  ] as const)('asks for the $section section', async ({ name, section }) => {
    const view = mount({ section: 'apps' })

    await userEvent.click(screen.getByRole('button', { name }))

    expect(view.emitted().section).toEqual([[section]])
    expect(view.emitted().openTemplates).toBeUndefined()
  })

  it('asks for the template browser without changing the section', async () => {
    const view = mount()

    await userEvent.click(screen.getByRole('button', { name: 'Templates' }))

    expect(view.emitted().openTemplates).toHaveLength(1)
    expect(view.emitted().section).toBeUndefined()
  })

  it('names its icon-only buttons on the rail', async () => {
    const view = mount({ section: 'workflows', compact: true })

    expect(
      screen.getAllByRole('button').map((button) => ({
        name: button.getAttribute('aria-label'),
        text: button.textContent,
        current: button.getAttribute('aria-current')
      }))
    ).toEqual([
      { name: 'Chats', text: '', current: null },
      { name: 'Apps', text: '', current: null },
      { name: 'Workflows', text: '', current: 'page' },
      { name: 'Templates', text: '', current: null }
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Apps' }))
    await userEvent.click(screen.getByRole('button', { name: 'Templates' }))

    expect(view.emitted().section).toEqual([['apps']])
    expect(view.emitted().openTemplates).toHaveLength(1)
  })
})
