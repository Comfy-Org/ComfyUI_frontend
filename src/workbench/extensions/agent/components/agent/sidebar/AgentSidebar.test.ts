import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'

import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import AgentSidebar from './AgentSidebar.vue'

const groups: HistoryGroups = {
  current: [
    { id: 'now', title: 'Seedance clip', updatedAt: 3, titleSource: 'server' }
  ],
  today: [
    { id: 'fox', title: 'Fox portrait', updatedAt: 2, titleSource: 'server' }
  ],
  yesterday: [],
  earlier: [
    { id: 'old', title: 'Batch upscale', updatedAt: 1, titleSource: 'server' }
  ]
}

function mount(props: Partial<ComponentProps<typeof AgentSidebar>> = {}) {
  return render(AgentSidebar, {
    props: { mode: 'expanded', groups, ...props },
    slots: {
      brand: '<span data-testid="brand">Comfy Agent</span>',
      footer: `<template #footer="{ compact }"><span data-testid="footer">{{ compact ? 'compact' : 'full' }}</span></template>`,
      library: `<template #library="{ section }"><span data-testid="library">{{ section }}</span></template>`,
      account: `<template #account="{ compact }"><span data-testid="account">{{ compact ? 'compact' : 'full' }}</span></template>`
    },
    global: { plugins: [i18n], directives: { tooltip: {} } }
  })
}

describe('AgentSidebar', () => {
  it('lists the chats under a Chats heading when expanded', () => {
    mount()
    const list = screen.getByRole('navigation', { name: 'Chats' })

    expect(screen.getByRole('heading', { name: 'Chats' })).toBeVisible()
    expect(
      within(list).getByRole('button', { name: 'Fox portrait' })
    ).toBeVisible()
    expect(
      within(list).getByRole('button', { name: 'Batch upscale' })
    ).toBeVisible()
    expect(screen.getByTestId('footer')).toHaveTextContent('full')
  })

  it('shows the brand above the chats, but not on the rail', async () => {
    const view = mount()

    expect(screen.getByTestId('brand')).toBeVisible()

    await view.rerender({ mode: 'rail' })

    expect(screen.queryByTestId('brand')).toBeNull()
  })

  it('emits the chat that was picked', async () => {
    const view = mount()

    await userEvent.click(screen.getByRole('button', { name: 'Fox portrait' }))

    expect(view.emitted().select).toEqual([['fox']])
  })

  it('starts a new chat from the plus button', async () => {
    const view = mount()

    await userEvent.click(screen.getByRole('button', { name: 'New chat' }))

    expect(view.emitted().newChat).toHaveLength(1)
  })

  it('collapses from the toggle and says it is open', async () => {
    const view = mount()
    const toggle = screen.getByRole('button', { name: 'Close sidebar' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(toggle)

    expect(view.emitted().toggle).toHaveLength(1)
  })

  it('hides the list as a rail but keeps new chat and a compact footer', () => {
    mount({ mode: 'rail' })

    expect(screen.queryByRole('navigation', { name: 'Chats' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Fox portrait' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Open sidebar' })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'New chat' })).toBeVisible()
    expect(screen.getByTestId('footer')).toHaveTextContent('compact')
  })

  it('closes the drawer from its scrim and from Escape', async () => {
    const view = mount({ mode: 'drawer' })

    await userEvent.click(screen.getByTestId('agent-sidebar-scrim'))
    screen.getByRole('button', { name: 'Fox portrait' }).focus()
    await userEvent.keyboard('{Escape}')

    expect(view.emitted().dismissDrawer).toHaveLength(2)
  })

  it('leaves Escape alone when it is not a drawer', async () => {
    const view = mount()

    screen.getByRole('button', { name: 'Fox portrait' }).focus()
    await userEvent.keyboard('{Escape}')

    expect(view.emitted().dismissDrawer).toBeUndefined()
  })

  it('keeps focus on the chosen section when the rail opens', async () => {
    const view = mount({ mode: 'rail', section: 'apps' })
    screen.getByRole('button', { name: 'Apps' }).focus()

    await view.rerender({ mode: 'expanded', section: 'apps' })
    await nextTick()

    expect(screen.getByRole('button', { name: 'Apps' })).toHaveFocus()
  })

  it('marks the chat that is opening', () => {
    mount({ loadingId: 'fox' })

    expect(screen.getByRole('button', { name: 'Fox portrait' })).toBeDisabled()
  })

  it.for([
    { mode: 'expanded', styleWidth: '340px' },
    { mode: 'rail', styleWidth: '' },
    { mode: 'drawer', styleWidth: '' }
  ] as const)(
    'has the inline width "$styleWidth" when $mode',
    ({ mode, styleWidth }) => {
      mount({ mode, width: 340 })

      expect(screen.getByTestId('agent-sidebar').style.width).toBe(styleWidth)
    }
  )

  it('has a resize handle that reports its width when expanded', () => {
    mount({ width: 300 })

    const handle = screen.getByRole('separator', { name: 'Resize sidebar' })
    expect(handle).toHaveAttribute('aria-orientation', 'vertical')
    expect(handle).toHaveAttribute('aria-valuenow', '300')
    expect(handle).toHaveAttribute('aria-valuemin', '220')
    expect(handle).toHaveAttribute('aria-valuemax', '480')
    expect(handle).toHaveAttribute('tabindex', '0')
  })

  it.for(['rail', 'drawer'] as const)(
    'has no resize handle as a %s',
    (mode) => {
      mount({ mode })

      expect(screen.queryByRole('separator')).toBeNull()
    }
  )

  it.for([
    { key: 'ArrowRight', width: 316 },
    { key: 'ArrowLeft', width: 284 },
    { key: 'Home', width: 220 },
    { key: 'End', width: 480 }
  ])('asks for $width on $key from 300', async ({ key, width }) => {
    const view = mount({ width: 300 })

    screen.getByRole('separator', { name: 'Resize sidebar' }).focus()
    await userEvent.keyboard(`{${key}}`)

    expect(view.emitted().resize).toEqual([[width]])
  })

  it('leaves an arrow key held with a modifier to the browser', async () => {
    const view = mount({ width: 300 })

    screen.getByRole('separator', { name: 'Resize sidebar' }).focus()
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}')

    expect(view.emitted().resize).toBeUndefined()
  })

  it('asks to reset the width on Enter', async () => {
    const view = mount({ width: 300 })

    screen.getByRole('separator', { name: 'Resize sidebar' }).focus()
    await userEvent.keyboard('{Enter}')

    expect(view.emitted().resetWidth).toHaveLength(1)
  })

  it('asks to reset the width on a double click', async () => {
    const view = mount({ width: 300 })

    await userEvent.dblClick(
      screen.getByRole('separator', { name: 'Resize sidebar' })
    )

    expect(view.emitted().resetWidth).toHaveLength(1)
    expect(view.emitted().resize).toBeUndefined()
  })

  it('asks for widths that follow the pointer while the handle is dragged', async () => {
    const user = userEvent.setup()
    const view = mount({ width: 300 })
    const handle = screen.getByRole('separator', { name: 'Resize sidebar' })

    await user.pointer({
      keys: '[MouseLeft>]',
      target: handle,
      coords: { x: 302, y: 10 }
    })
    expect(handle).toHaveAttribute('data-resizing', 'true')
    await user.pointer({ coords: { x: 342, y: 10 } })
    await user.pointer({ coords: { x: 152, y: 10 } })
    await user.pointer({ coords: { x: 902, y: 10 } })

    expect(view.emitted().resize).toEqual([[340], [150], [900]])
  })

  it.for(['pointerup', 'pointercancel', 'lostpointercapture'] as const)(
    'stops following the pointer after %s',
    async (ending) => {
      const user = userEvent.setup()
      const view = mount({ width: 300 })
      const handle = screen.getByRole('separator', { name: 'Resize sidebar' })
      await user.pointer({
        keys: '[MouseLeft>]',
        target: handle,
        coords: { x: 302, y: 10 }
      })
      await user.pointer({ coords: { x: 342, y: 10 } })

      await fireEvent(handle, new PointerEvent(ending, { bubbles: true }))
      await user.pointer({ coords: { x: 402, y: 10 } })

      expect(view.emitted().resize).toEqual([[340]])
      expect(handle).toHaveAttribute('data-resizing', 'false')
    }
  )

  it('does not start a drag from the secondary mouse button', async () => {
    const user = userEvent.setup()
    const view = mount({ width: 300 })

    await user.pointer({
      keys: '[MouseRight>]',
      target: screen.getByRole('separator', { name: 'Resize sidebar' }),
      coords: { x: 302, y: 10 }
    })
    await user.pointer({ coords: { x: 342, y: 10 } })

    expect(view.emitted().resize).toBeUndefined()
  })

  it('captures the pointer and keeps text from being selected when a drag starts', () => {
    mount()
    const handle = screen.getByRole('separator', { name: 'Resize sidebar' })
    const press = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerId: 7
    })

    handle.dispatchEvent(press)

    expect(press.defaultPrevented).toBe(true)
    expect(handle.hasPointerCapture(7)).toBe(true)
  })

  it('puts the section nav between the brand and the list', () => {
    mount()
    const nav = screen.getByRole('navigation', { name: 'Agent sections' })

    expect(
      screen.getByTestId('brand').compareDocumentPosition(nav) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      nav.compareDocumentPosition(
        screen.getByRole('navigation', { name: 'Chats' })
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(within(nav).getByRole('button', { name: 'Chats' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it.for([
    { section: 'apps', heading: 'Apps' },
    { section: 'workflows', heading: 'Workflows' }
  ] as const)(
    'swaps the chats for the $section library',
    ({ section, heading }) => {
      mount({ section })

      expect(screen.getByRole('heading', { name: heading })).toBeVisible()
      expect(
        within(screen.getByRole('navigation', { name: heading })).getByTestId(
          'library'
        )
      ).toHaveTextContent(section)
      expect(screen.queryByRole('navigation', { name: 'Chats' })).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Chats' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'New chat' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Fox portrait' })).toBeNull()
    }
  )

  it('keeps the library out of the chats section', () => {
    mount()

    expect(screen.queryByTestId('library')).toBeNull()
  })

  it('passes on the section and the template browser that were asked for', async () => {
    const view = mount()
    const nav = within(
      screen.getByRole('navigation', { name: 'Agent sections' })
    )

    await userEvent.click(nav.getByRole('button', { name: 'Workflows' }))
    await userEvent.click(nav.getByRole('button', { name: 'Templates' }))

    expect(view.emitted().section).toEqual([['workflows']])
    expect(view.emitted().openTemplates).toHaveLength(1)
  })

  it('puts the account between the brand and the section nav', () => {
    mount()
    const account = screen.getByTestId('account')

    expect(account).toHaveTextContent('full')
    expect(
      screen.getByTestId('brand').compareDocumentPosition(account) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      account.compareDocumentPosition(
        screen.getByRole('navigation', { name: 'Agent sections' })
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('keeps a compact account above new chat on the rail', () => {
    mount({ mode: 'rail' })
    const account = screen.getByTestId('account')

    expect(account).toHaveTextContent('compact')
    expect(
      screen
        .getByRole('button', { name: 'Open sidebar' })
        .compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      account.compareDocumentPosition(
        screen.getByRole('button', { name: 'New chat' })
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('keeps the sections reachable from the rail', async () => {
    const view = mount({ mode: 'rail', section: 'apps' })
    const nav = within(
      screen.getByRole('navigation', { name: 'Agent sections' })
    )

    await userEvent.click(nav.getByRole('button', { name: 'Workflows' }))
    await userEvent.click(nav.getByRole('button', { name: 'Templates' }))

    expect(nav.getByRole('button', { name: 'Apps' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.queryByTestId('library')).toBeNull()
    expect(view.emitted().section).toEqual([['workflows']])
    expect(view.emitted().openTemplates).toHaveLength(1)
  })
})
