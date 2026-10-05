import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { DropdownMenuItem } from 'reka-ui'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import Menu from './Menu.vue'
import ContextMenu from './ContextMenu.vue'

describe('Menu', () => {
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
      props: { items: [{ label: 'Run' }], modal: false },
      slots: { trigger: '<button>Open</button>' }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await screen.findByRole('menu')
    expect(document.body.style.pointerEvents).not.toBe('none')
  })

  it('disables commandless actions', async () => {
    render(Menu, {
      props: { items: [{ label: 'Unavailable' }] },
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
        props: { items: [{ label, command }] },
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
      props: { items: [{ label: 'Run' }], open: true },
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
      props: { items: [{ label: 'Run' }] },
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

  it('dismisses a context menu before an outside pointer event is stopped', async () => {
    render(
      defineComponent({
        components: { ContextMenu },
        setup() {
          const menu = ref<InstanceType<typeof ContextMenu>>()
          return { menu }
        },
        template:
          '<button @contextmenu.prevent="menu?.show($event)">Target</button><button @pointerdown.stop>Outside</button><ContextMenu ref="menu" :model="[{ label: \'Inspect\' }]" />'
      })
    )
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
      target: screen.getByRole('button', { name: 'Outside', hidden: true })
    })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('keeps a context menu open when focus moves outside', async () => {
    render(
      defineComponent({
        components: { ContextMenu },
        setup() {
          const menu = ref<InstanceType<typeof ContextMenu>>()
          return { menu }
        },
        template:
          '<button @contextmenu.prevent="menu?.show($event)">Target</button><button>Outside</button><ContextMenu ref="menu" :model="[{ label: \'Inspect\' }]" />'
      })
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Target' })
    })
    await screen.findByRole('menu')
    const outside = screen.getByRole('button', {
      name: 'Outside',
      hidden: true
    })
    const focusOutside = vi.fn()
    outside.addEventListener('dismissableLayer.focusOutside', focusOutside)
    outside.focus()
    await waitFor(() => expect(focusOutside).toHaveBeenCalled())
    await nextTick()

    expect(screen.getByRole('menu')).toBeVisible()
  })

  it('opens from a stopped pointer context-menu event', async () => {
    const menu = ref<InstanceType<typeof ContextMenu>>()
    const selected = ref(false)
    render(
      defineComponent({
        components: { ContextMenu },
        setup: () => ({ menu, selected }),
        template:
          '<button @contextmenu.prevent.stop="selected = true; menu?.show($event)">Widget</button><button v-if="selected">Selection tools</button><ContextMenu ref="menu" :model="[{ label: \'Inspect\' }]" />'
      })
    )
    screen.getByRole('button', { name: 'Widget' }).dispatchEvent(
      new PointerEvent('contextmenu', {
        bubbles: true,
        button: 2,
        clientX: 100,
        clientY: 120
      })
    )

    expect(menu.value?.visible).toBe(true)
    expect(
      await screen.findByRole('menuitem', { name: 'Inspect' })
    ).toBeVisible()
  })

  it('closes a context menu without dispatching Escape', async () => {
    const onKeydown = vi.fn()
    document.addEventListener('keydown', onKeydown)
    onTestFinished(() => document.removeEventListener('keydown', onKeydown))
    const menu = ref<InstanceType<typeof ContextMenu>>()
    render(
      defineComponent({
        components: { ContextMenu },
        setup: () => ({ menu }),
        template:
          '<button @contextmenu.prevent="menu?.show($event)">Target</button><ContextMenu ref="menu" :model="[{ label: \'Inspect\' }]" />'
      })
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Target' })
    })
    await screen.findByRole('menu')
    menu.value?.hide()

    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    )
    expect(onKeydown).not.toHaveBeenCalled()
  })

  it('stays closed when its open trigger is clicked', async () => {
    const menu = ref<InstanceType<typeof ContextMenu>>()
    render(
      defineComponent({
        components: { ContextMenu },
        setup: () => ({ menu }),
        template:
          '<button @click="menu?.toggle($event)" @contextmenu.prevent="menu?.show($event)">Target</button><ContextMenu ref="menu" :model="[{ label: \'Inspect\' }]" />'
      })
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const trigger = screen.getByRole('button', { name: 'Target' })

    await user.pointer({ keys: '[MouseRight]', target: trigger })
    await screen.findByRole('menu')
    await user.click(trigger)

    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    )
  })

  it('dismisses only the context menu that owns the clicked content', async () => {
    const first = ref<InstanceType<typeof ContextMenu>>()
    const second = ref<InstanceType<typeof ContextMenu>>()
    render(
      defineComponent({
        components: { ContextMenu },
        setup: () => ({ first, second }),
        template:
          '<button @contextmenu.prevent="first?.show($event)">First</button><button @contextmenu.prevent="second?.show($event)">Second</button><ContextMenu ref="first" :model="[{ label: \'First action\' }]" /><ContextMenu ref="second" :model="[{ label: \'Second action\' }]" />'
      })
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'First' })
    })
    await screen.findByRole('menuitem', { name: 'First action' })
    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Second' })
    })

    expect(
      await screen.findByRole('menuitem', { name: 'Second action' })
    ).toBeVisible()
    expect(
      screen.queryByRole('menuitem', { name: 'First action' })
    ).not.toBeInTheDocument()
  })

  it('keeps a context menu open when its own submenu is clicked', async () => {
    const menu = ref<InstanceType<typeof ContextMenu>>()
    render(
      defineComponent({
        components: { ContextMenu },
        setup: () => ({ menu }),
        template:
          '<button @contextmenu.prevent="menu?.show($event)">Target</button><ContextMenu ref="menu" :model="[{ label: \'More\', items: [{ label: \'Child\' }] }]" />'
      })
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Target' })
    })
    await user.hover(await screen.findByRole('menuitem', { name: 'More' }))
    const child = await screen.findByRole('menuitem', { name: 'Child' })
    child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()

    expect(screen.getByRole('menuitem', { name: 'Child' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'More' })).toBeVisible()
  })
})
