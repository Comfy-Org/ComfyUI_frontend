import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { DropdownMenuItem } from 'reka-ui'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import Menu from './Menu.vue'
import ContextMenu from './ContextMenu.vue'
import type { MenuItem } from './types'

describe('Menu', () => {
  it('renders item badges in nested menus', async () => {
    render(Menu, {
      props: {
        items: [{ label: 'More', items: [{ label: 'Run', badge: 'Beta' }] }]
      },
      slots: { trigger: '<button>Open</button>' }
    })
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.hover(await screen.findByRole('menuitem', { name: 'More' }))

    expect(await screen.findByText('Beta')).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Run' })).toHaveTextContent(
      'Beta'
    )
  })

  it('executes a quick press-and-hold click exactly once', async () => {
    const command = vi.fn()
    render(Menu, {
      props: {
        open: true,
        items: [{ label: 'Zoom', command, pressAndHoldInterval: 50 }]
      },
      slots: { trigger: '<button>Open</button>' }
    })
    const item = await screen.findByRole('menuitem', { name: 'Zoom' })
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      pointerEventsCheck: 0
    })

    await user.pointer({ keys: '[MouseLeft>][/MouseLeft]', target: item })

    expect(command).toHaveBeenCalledOnce()
  })

  it('emits activate once with the item for a click', async () => {
    const onActivate = vi.fn()
    const item = { label: 'Rename', command: vi.fn() }
    render(Menu, {
      props: { open: true, items: [item], onActivate },
      slots: { trigger: '<button>Open</button>' }
    })
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))

    expect(onActivate).toHaveBeenCalledExactlyOnceWith(item)
  })

  it.for([
    { gesture: 'a click', role: 'menuitem', checked: undefined, hold: 0 },
    { gesture: 'a click', role: 'menuitemcheckbox', checked: false, hold: 0 },
    {
      gesture: 'a 100 ms hold',
      role: 'menuitem',
      checked: undefined,
      hold: 100
    },
    {
      gesture: 'a 100 ms hold',
      role: 'menuitemcheckbox',
      checked: false,
      hold: 100
    }
  ] as const)(
    'emits one activate event for $gesture on a press-and-hold $role',
    async ({ role, checked, hold }) => {
      const onActivate = vi.fn()
      render(Menu, {
        props: {
          open: true,
          items: [
            {
              label: 'Zoom',
              command: vi.fn(),
              pressAndHoldInterval: 50,
              checked
            }
          ],
          onActivate
        },
        slots: { trigger: '<button>Open</button>' }
      })
      const item = await screen.findByRole(role, { name: 'Zoom' })
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
        pointerEventsCheck: 0
      })

      await user.pointer({ keys: '[MouseLeft>]', target: item })
      await vi.advanceTimersByTimeAsync(hold)
      await user.pointer({ keys: '[/MouseLeft]', target: item })

      expect(onActivate).toHaveBeenCalledOnce()
    }
  )

  it('does not add a click command after press-and-hold repeats', async () => {
    const command = vi.fn()
    render(Menu, {
      props: {
        open: true,
        items: [{ label: 'Zoom', command, pressAndHoldInterval: 50 }]
      },
      slots: { trigger: '<button>Open</button>' }
    })
    const item = await screen.findByRole('menuitem', { name: 'Zoom' })
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      pointerEventsCheck: 0
    })

    await user.pointer({ keys: '[MouseLeft>]', target: item })
    await vi.advanceTimersByTimeAsync(100)
    await user.pointer({ keys: '[/MouseLeft]', target: item })

    expect(command).toHaveBeenCalledTimes(2)
  })

  it('does not repeat a disabled press-and-hold command', async () => {
    const command = vi.fn()
    render(Menu, {
      props: {
        open: true,
        items: [
          { label: 'Zoom', command, disabled: true, pressAndHoldInterval: 50 }
        ]
      },
      slots: { trigger: '<button>Open</button>' }
    })
    const item = await screen.findByRole('menuitem', { name: 'Zoom' })
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      pointerEventsCheck: 0
    })

    await user.pointer({ keys: '[MouseLeft>]', target: item })
    await vi.advanceTimersByTimeAsync(100)
    await user.pointer({ keys: '[/MouseLeft]', target: item })

    expect(command).not.toHaveBeenCalled()
  })

  it('accepts keyboard selection after a hold is released outside the row', async () => {
    const command = vi.fn()
    render(Menu, {
      props: {
        open: true,
        items: [{ label: 'Zoom', command, pressAndHoldInterval: 50 }]
      },
      slots: { trigger: '<button>Open</button>' }
    })
    const item = await screen.findByRole('menuitem', { name: 'Zoom' })
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      pointerEventsCheck: 0
    })

    await user.pointer({ keys: '[MouseLeft>]', target: item })
    await vi.advanceTimersByTimeAsync(100)
    await user.pointer({ keys: '[/MouseLeft]', target: document.body })
    item.focus()
    await user.keyboard('{Enter}')

    expect(command).toHaveBeenCalledTimes(3)
  })

  it('gives custom menu content keyboard selection and dismissal', async () => {
    const command = vi.fn()
    render(Menu, {
      props: { label: 'Actions' },
      slots: {
        trigger: '<button>Open</button>',
        default: () =>
          h(DropdownMenuItem, { onSelect: command }, () => 'Rename')
      }
    })
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const trigger = screen.getByRole('button', { name: 'Open' })
    await user.click(trigger)
    const item = await screen.findByRole('menuitem', { name: 'Rename' })
    expect(screen.getByText('Actions')).toBeVisible()
    expect(screen.getAllByRole('menuitem')).toEqual([item])
    await user.keyboard('{ArrowDown}')
    await waitFor(() => expect(item).toHaveFocus())
    await user.keyboard('{Enter}')
    expect(command).toHaveBeenCalledOnce()
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('keeps the page interactive for a non-modal menu', async () => {
    render(Menu, {
      props: {
        items: [{ label: 'Run' }],
        modal: false
      },
      slots: { trigger: '<button>Open</button>' }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await screen.findByRole('menu')
    expect(document.body.style.pointerEvents).not.toBe('none')
  })

  it('disables commandless actions', async () => {
    render(Menu, {
      props: {
        items: [{ label: 'Unavailable' }]
      },
      slots: { trigger: '<button>Open</button>' }
    })

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(
      await screen.findByRole('menuitem', { name: 'Unavailable' })
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it.for([
    { kind: 'string', label: 'Run' },
    { kind: 'getter', label: () => 'Run' }
  ])(
    'renders a $kind label, runs a command, and dismisses with Escape',
    async ({ label }) => {
      const command = vi.fn()
      render(Menu, {
        props: {
          items: [{ label, command }]
        },
        slots: { trigger: '<button>Open</button>' }
      })
      const user = userEvent.setup({ pointerEventsCheck: 0 })

      await user.click(screen.getByRole('button', { name: 'Open' }))
      const item = await screen.findByRole('menuitem', { name: 'Run' })
      expect(item).toHaveTextContent(/^Run$/)
      await user.click(item)
      expect(command).toHaveBeenCalledOnce()

      await user.click(screen.getByRole('button', { name: 'Open' }))
      await screen.findByRole('menu')
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    }
  )

  it.for([
    { kind: 'boolean', visible: false },
    { kind: 'getter', visible: () => false }
  ])('hides separators with $kind visibility', async ({ visible }) => {
    render(Menu, {
      props: {
        items: [
          { label: 'Download' },
          { separator: true },
          { label: 'Inspect' },
          { separator: true, visible },
          { label: 'Delete', visible }
        ]
      },
      slots: { trigger: '<button>Open</button>' }
    })

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await screen.findByRole('menu')

    expect(screen.getAllByRole('separator')).toHaveLength(1)
    expect(
      screen.queryByRole('menuitem', { name: 'Delete' })
    ).not.toBeInTheDocument()
  })

  it('closes when its owner changes the open state', async () => {
    const { rerender } = render(Menu, {
      props: {
        items: [{ label: 'Run' }],
        open: true
      },
      slots: { trigger: '<button>Open</button>' }
    })
    await screen.findByRole('menu')

    await rerender({ open: false })

    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    )
  })

  it('resolves class getters on actions and submenu triggers', async () => {
    render(Menu, {
      props: {
        items: [
          { label: 'Action', class: () => 'action-class' },
          {
            label: 'Submenu',
            class: () => 'submenu-class',
            items: [{ label: 'Child' }]
          }
        ]
      },
      slots: { trigger: '<button>Open</button>' }
    })
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.click(screen.getByRole('button', { name: 'Open' }))

    expect(await screen.findByRole('menuitem', { name: 'Action' })).toHaveClass(
      'action-class'
    )
    expect(screen.getByRole('menuitem', { name: 'Submenu' })).toHaveClass(
      'submenu-class'
    )
  })

  it('updates checked state and shortcut getters without dismissing the menu', async () => {
    const checked = ref(false)
    const shortcut = ref('Ctrl+G')
    render(Menu, {
      props: {
        items: [
          {
            label: 'Grid',
            checked: () => checked.value,
            shortcut: () => shortcut.value,
            command: () => {
              checked.value = !checked.value
            }
          }
        ]
      },
      slots: { trigger: '<button>Open</button>' }
    })
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    await user.click(screen.getByRole('button', { name: 'Open' }))
    const item = await screen.findByRole('menuitemcheckbox', { name: 'Grid' })
    expect(item).not.toBeChecked()
    expect(item).toHaveTextContent('Ctrl+G')

    await user.click(item)
    shortcut.value = 'Alt+G'

    await waitFor(() => expect(item).toBeChecked())
    expect(item).toBeVisible()
    expect(item).toHaveTextContent('Alt+G')
  })

  it('renders mutually exclusive choices as radio menu items', async () => {
    const selectCompact = vi.fn()
    render(Menu, {
      props: {
        items: [
          {
            label: 'Density',
            radioGroup: {
              value: 'comfortable',
              options: [
                {
                  value: 'comfortable',
                  label: 'Comfortable',
                  command: vi.fn()
                },
                {
                  value: 'compact',
                  label: 'Compact',
                  command: selectCompact
                }
              ]
            }
          }
        ]
      },
      slots: { trigger: '<button>Open</button>' }
    })
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.keyboard('{ArrowDown}{ArrowRight}')
    const comfortable = await screen.findByRole('menuitemradio', {
      name: 'Comfortable'
    })
    const compact = screen.getByRole('menuitemradio', { name: 'Compact' })

    expect(comfortable).toBeChecked()
    expect(compact).not.toBeChecked()
    await user.click(compact)
    expect(selectCompact).toHaveBeenCalledOnce()
  })

  it('toggles closed and reopens from its trigger', async () => {
    render(Menu, {
      props: {
        items: [{ label: 'Run' }]
      },
      slots: { trigger: '<button>Open</button>' }
    })
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const trigger = screen.getByRole('button', { name: 'Open' })

    await user.click(trigger)
    await screen.findByRole('menu')
    await user.click(trigger)
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    )
    await user.click(trigger)
    expect(await screen.findByRole('menuitem', { name: 'Run' })).toBeVisible()
  })

  it('does not poll geometry while a pointer-anchored context menu is idle', async () => {
    renderContextMenu()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Target' })
    })
    await screen.findByRole('menu')
    await vi.advanceTimersByTimeAsync(100)
    const measure = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')

    await vi.advanceTimersByTimeAsync(160)

    expect(measure).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeVisible()
  })

  it.for([
    { name: 'an outside element', target: 'Outside' },
    { name: 'the element it opened from', target: 'Target' }
  ])('dismisses a context menu when $name is pressed', async ({ target }) => {
    renderContextMenu({ outside: '<button>Outside</button>' })
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Target' })
    })
    expect(
      await screen.findByRole('menuitem', { name: 'Inspect' })
    ).toBeVisible()

    await user.pointer({
      keys: '[MouseLeft>]',
      target: screen.getByRole('button', { name: target, hidden: true })
    })
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    )
  })

  it('closes a context menu without dispatching Escape when its owner closes it', async () => {
    const onKeydown = vi.fn()
    document.addEventListener('keydown', onKeydown)
    onTestFinished(() => document.removeEventListener('keydown', onKeydown))
    const open = ref(false)
    renderContextMenu({ open })
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Target' })
    })
    await screen.findByRole('menu')
    expect(open.value).toBe(true)
    open.value = false

    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    )
    expect(onKeydown).not.toHaveBeenCalled()
  })

  it('dismisses a context menu with Escape', async () => {
    renderContextMenu()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Target' })
    })
    await screen.findByRole('menu')
    await user.keyboard('{Escape}')

    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    )
  })

  it('keeps the page interactive while a context menu is open', async () => {
    renderContextMenu()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Target' })
    })
    await screen.findByRole('menu')

    expect(document.body.style.pointerEvents).not.toBe('none')
  })

  it('does not open a context menu without visible items', async () => {
    renderContextMenu({ model: [{ label: 'Inspect', visible: false }] })
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Target' })
    })
    await nextTick()

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('keeps a context menu open when its own submenu is clicked', async () => {
    renderContextMenu({
      model: [{ label: 'More', items: [{ label: 'Child' }] }]
    })
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Target' })
    })
    await user.hover(await screen.findByRole('menuitem', { name: 'More' }))
    const child = await screen.findByRole('menuitem', { name: 'Child' })
    await user.pointer({ keys: '[MouseLeft>]', target: child })

    expect(screen.getByRole('menuitem', { name: 'Child' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'More' })).toBeVisible()
  })
})

function renderContextMenu({
  model = [{ label: 'Inspect' }],
  open = ref(false),
  outside = ''
}: {
  model?: MenuItem[]
  open?: Ref<boolean>
  outside?: string
} = {}) {
  return render(
    defineComponent({
      components: { ContextMenu },
      setup: () => ({ model, open }),
      template: `<ContextMenu v-model:open="open" :model><button>Target</button></ContextMenu>${outside}`
    })
  )
}
