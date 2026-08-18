/**
 * A pack can own a sidebar tab, which is the entire purpose of several packs
 * rather than a decoration.
 */
import { createTestingPinia } from '@pinia/testing'
import userEvent from '@testing-library/user-event'
import { render as renderComponent, screen } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, defineComponent, h } from 'vue'

import { useDialogStore } from '@/stores/dialogStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import { createUiHandle } from './uiHandle'

const hostPrompt = vi.hoisted(() => vi.fn())
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ prompt: hostPrompt })
}))

describe('comfy.ui.addSidebarTab', () => {
  let ui: ReturnType<typeof createUiHandle>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    ui = createUiHandle()
  })

  const tab = (id = 'mtb.assets') => ({
    id,
    title: 'Assets',
    icon: 'icon-[lucide--folder]',
    render: () => {}
  })

  it('registers a tab the host will render', () => {
    ui.addSidebarTab(tab())

    const registered = useSidebarTabStore().sidebarTabs.find(
      (t) => t.id === 'mtb.assets'
    )
    expect(registered?.title).toBe('Assets')
    // The host renders a pack's tab by calling `render` with a container;
    // the Vue arm of the union is not reachable from plain JavaScript.
    expect(registered?.type).toBe('custom')
  })

  it('hands the host the pack render and destroy functions', () => {
    const render = vi.fn()
    const destroy = vi.fn()

    ui.addSidebarTab({ id: 'p.tab', title: 'T', render, destroy })

    const registered = useSidebarTabStore().sidebarTabs.find(
      (t) => t.id === 'p.tab'
    )
    const container = document.createElement('div')
    // Stands in for ExtensionSlot, which owns this lifecycle.
    if (registered?.type === 'custom') {
      registered.render(container)
      registered.destroy?.()
    }

    expect(render).toHaveBeenCalledWith(container)
    expect(destroy).toHaveBeenCalled()
  })

  it('removes the tab again when the pack unsubscribes', () => {
    const stop = ui.addSidebarTab(tab())

    stop()

    expect(
      useSidebarTabStore().sidebarTabs.some((t) => t.id === 'mtb.assets')
    ).toBe(false)
  })

  it('refuses a duplicate id rather than replacing another pack silently', () => {
    ui.addSidebarTab(tab())

    expect(() => ui.addSidebarTab(tab())).toThrow(/already registered/)
    expect(useSidebarTabStore().sidebarTabs).toHaveLength(1)
  })

  it('refuses an empty id', () => {
    expect(() => ui.addSidebarTab({ ...tab(''), id: '  ' })).toThrow()
  })

  it('registers a Vue component tab the host mounts itself', () => {
    // The frontend is a Vue app and the API is built on that: a pack that
    // builds with Vite passes its component and keeps reactivity and scoped
    // styles, rather than hand-rolling a second mount into a container.
    const component = defineComponent({ setup: () => () => h('div', 'hi') })

    ui.addSidebarTab({ id: 'p.vue', title: 'Vue', component })

    const registered = useSidebarTabStore().sidebarTabs.find(
      (t) => t.id === 'p.vue'
    )
    expect(registered?.type).toBe('vue')
    expect(
      registered && 'component' in registered && registered.component
    ).toBe(component)
  })

  it('removes a Vue tab on unsubscribe too', () => {
    const component = defineComponent({ setup: () => () => h('div') })
    const stop = ui.addSidebarTab({ id: 'p.vue2', title: 'V', component })

    stop()

    expect(
      useSidebarTabStore().sidebarTabs.some((t) => t.id === 'p.vue2')
    ).toBe(false)
  })

  it('omits an icon the pack did not give rather than passing undefined', () => {
    ui.addSidebarTab({ id: 'p.plain', title: 'Plain', render: () => {} })

    const registered = useSidebarTabStore().sidebarTabs.find(
      (t) => t.id === 'p.plain'
    )
    expect(registered && 'icon' in registered).toBe(false)
  })
})

describe('comfy.ui.showDialog', () => {
  let ui: ReturnType<typeof createUiHandle>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    ui = createUiHandle()
  })

  const stack = () => useDialogStore().dialogStack

  it('opens a dialog under a key namespaced away from core dialogs', () => {
    ui.showDialog({ key: 'mtb.notePlus', title: 'Note', render: () => {} })

    // The host reserves the unprefixed keyspace for its own dialogs.
    expect(stack().some((d) => d.key === 'extension-mtb.notePlus')).toBe(true)
  })

  it('mounts a pack render function and tears it down', async () => {
    const render = vi.fn()
    const destroy = vi.fn()
    ui.showDialog({ key: 'p.d', render, destroy })

    const dialog = stack().find((d) => d.key === 'extension-p.d')!
    const { unmount } = renderComponent(dialog.component as never)
    await nextTick()
    expect(render).toHaveBeenCalledWith(expect.any(HTMLElement))

    unmount()
    expect(destroy).toHaveBeenCalled()
  })

  it('passes a Vue component straight through', () => {
    const component = defineComponent({ setup: () => () => h('div') })
    ui.showDialog({ key: 'p.vued', component })

    expect(stack().find((d) => d.key === 'extension-p.vued')?.component).toBe(
      component
    )
  })

  it('closes via the returned handle', () => {
    const handle = ui.showDialog({ key: 'p.close', render: () => {} })
    expect(stack().some((d) => d.key === 'extension-p.close')).toBe(true)

    handle.close()

    const dialog = stack().find((d) => d.key === 'extension-p.close')
    expect(dialog === undefined || dialog.visible === false).toBe(true)
  })

  it('refuses an empty key', () => {
    expect(() => ui.showDialog({ key: '  ', render: () => {} })).toThrow()
  })
})

describe('comfy.ui.showMenu', () => {
  let ui: ReturnType<typeof createUiHandle>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    ui = createUiHandle()
  })

  function open(items: Parameters<typeof ui.showMenu>[0]['items']) {
    ui.showMenu({
      items,
      event: new MouseEvent('contextmenu', { clientX: 40, clientY: 60 })
    })
  }

  it('shows an item and runs it when clicked', async () => {
    const run = vi.fn()
    // The menu renders itself into the body; there is no component to render()
    // here, so screen is the only handle on it.
    open([{ label: 'Move Up', run }])

    await userEvent.click(screen.getByText('Move Up'))

    expect(run).toHaveBeenCalledOnce()
  })

  it('does not run a submenu parent on the way past', async () => {
    // The renderer fires both the item callback and opens the submenu, so a
    // parent carrying a callback would act as well as expand.
    const run = vi.fn()
    open([{ label: 'Strength', run, submenu: [{ label: 'Reset', run }] }])

    await userEvent.click(screen.getByText('Strength'))

    expect(run).not.toHaveBeenCalled()
  })

  it('returns a handle that closes the menu', () => {
    const menu = ui.showMenu({
      items: [{ label: 'Suggestion' }],
      event: new MouseEvent('contextmenu')
    })

    expect(screen.getByText('Suggestion')).toBeInTheDocument()
    menu.close()
    expect(screen.queryByText('Suggestion')).not.toBeInTheDocument()
  })

  it('selects flat and nested items from the keyboard', async () => {
    const flat = vi.fn()
    open([
      { label: 'Disabled', disabled: true },
      { label: 'Second', run: flat }
    ])

    await userEvent.keyboard('{ArrowDown}{ArrowRight}')
    expect(flat).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}')
    expect(flat).toHaveBeenCalledOnce()

    const nested = vi.fn()
    open([{ label: 'Folder', submenu: [{ label: 'Leaf', run: nested }] }])

    await userEvent.keyboard('{ArrowDown}{ArrowRight}{ArrowLeft}{Tab}{Tab}')
    expect(nested).toHaveBeenCalledOnce()
  })

  it('closes from the keyboard', async () => {
    open([{ label: 'Suggestion' }])

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByText('Suggestion')).not.toBeInTheDocument()
  })

  it('refuses an empty menu', () => {
    expect(() =>
      ui.showMenu({ items: [], event: new MouseEvent('contextmenu') })
    ).toThrow(/at least one item/)
  })
})

describe('comfy.ui.prompt', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    hostPrompt.mockReset()
  })

  it('reports a cancel as undefined, not null', async () => {
    // The host spells cancelled `null`; every other absent value in this API is
    // `undefined`, and two spellings of absent is a bug waiting to happen.
    hostPrompt.mockResolvedValue(null)

    await expect(createUiHandle().prompt({ label: 'Strength' })).resolves.toBe(
      undefined
    )
  })

  it('passes the value back when the user answers', async () => {
    hostPrompt.mockResolvedValue('1.25')

    await expect(createUiHandle().prompt({ label: 'Strength' })).resolves.toBe(
      '1.25'
    )
  })

  it('refuses a prompt with no label', async () => {
    await expect(createUiHandle().prompt({ label: ' ' })).rejects.toThrow(
      /needs a label/
    )
  })
})
