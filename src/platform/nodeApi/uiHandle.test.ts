/**
 * A pack can own a sidebar tab, which is the entire purpose of several packs
 * rather than a decoration.
 */
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import { createUiHandle } from './uiHandle'

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
