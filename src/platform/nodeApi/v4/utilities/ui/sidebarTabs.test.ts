import { reportError } from '@comfyorg/telemetry/reportError'
import { render } from '@testing-library/vue'
import { assert, describe, expect, it, vi } from 'vitest'

import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { SidebarTabDef } from '@/platform/nodeApi/v4/types'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

function uiApi() {
  return createComfyApi({ getGraph: () => null }).comfy.ui
}

function tab(overrides: Partial<SidebarTabDef> = {}): SidebarTabDef {
  return {
    id: 'MyPack.assets',
    title: 'Assets',
    icon: 'icon-[lucide--box]',
    tooltip: 'Pack assets',
    render: vi.fn((container: HTMLElement) => {
      container.textContent = 'pack content'
    }),
    destroy: vi.fn(),
    ...overrides
  }
}

function registeredTab(
  id: string
): Extract<SidebarTabExtension, { type: 'custom' }> {
  const found = useSidebarTabStore().sidebarTabs.find(
    (entry) => entry.id === id
  )
  assert(found?.type === 'custom', `no custom tab ${id}`)
  return found
}

function showTab(id: string) {
  return render(ExtensionSlot, { props: { extension: registeredTab(id) } })
}

describe('sidebar tabs', () => {
  it('adds a tab with a toggle command, and renders the pack content when shown', () => {
    const definition = tab()
    uiApi().addSidebarTab(definition)

    const shown = showTab('MyPack.assets')

    expect(registeredTab('MyPack.assets')).toMatchObject({
      title: 'Assets',
      icon: 'icon-[lucide--box]',
      tooltip: 'Pack assets'
    })
    expect(
      useCommandStore().isRegistered('Workspace.ToggleSidebarTab.MyPack.assets')
    ).toBe(true)
    expect(shown.container.textContent).toBe('pack content')
    expect(definition.render).toHaveBeenCalledOnce()
  })

  it('calls destroy once each time the shown tab is taken down', () => {
    const definition = tab()
    uiApi().addSidebarTab(definition)

    showTab('MyPack.assets').unmount()
    showTab('MyPack.assets').unmount()

    expect(definition.destroy).toHaveBeenCalledTimes(2)
  })

  it('removes the tab, calling destroy once though the panel was shown', () => {
    const definition = tab()
    const remove = uiApi().addSidebarTab(definition)
    const shown = showTab('MyPack.assets')

    remove()
    shown.unmount()
    remove()

    expect(useSidebarTabStore().sidebarTabs).toEqual([])
    expect(definition.destroy).toHaveBeenCalledOnce()
  })

  it('takes down a shown tab that has no destroy', () => {
    const remove = uiApi().addSidebarTab(tab({ destroy: undefined }))

    showTab('MyPack.assets').unmount()
    remove()

    expect(useSidebarTabStore().sidebarTabs).toEqual([])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('does not call destroy for a tab never shown', () => {
    const definition = tab()

    uiApi().addSidebarTab(definition)()

    expect(definition.destroy).not.toHaveBeenCalled()
  })

  it('leaves a tab registered later under the same id when an old disposer runs', () => {
    const ui = uiApi()
    const removeFirst = ui.addSidebarTab(tab({ title: 'First' }))
    removeFirst()
    ui.addSidebarTab(tab({ title: 'Second' }))

    removeFirst()

    expect(registeredTab('MyPack.assets').title).toBe('Second')
  })

  it('refuses an id another tab has, and keeps the first', () => {
    const ui = uiApi()
    ui.addSidebarTab(tab())

    expect(() => ui.addSidebarTab(tab({ title: 'Other' }))).toThrow(
      new TypeError(
        "ui.addSidebarTab needs an id no other tab has, not 'MyPack.assets'."
      )
    )
    expect(useSidebarTabStore().sidebarTabs.map(({ title }) => title)).toEqual([
      'Assets'
    ])
  })

  it('reports a render or destroy that throws, and keeps the sidebar working', () => {
    const broken = new Error('pack render failed')
    uiApi().addSidebarTab(
      tab({
        render: () => {
          throw broken
        },
        destroy: () => {
          throw broken
        }
      })
    )

    showTab('MyPack.assets').unmount()

    expect(reportError).toHaveBeenCalledTimes(2)
    expect(reportError).toHaveBeenCalledWith(
      broken,
      expect.objectContaining({ tags: { event: 'ui.addSidebarTab' } })
    )
  })

  it.for([
    { name: 'no tab', value: null, needs: 'a sidebar tab as a plain object' },
    {
      name: 'a field a tab does not have',
      value: { ...tab(), label: 'Assets' },
      needs: 'a sidebar tab of id, title, icon, tooltip, render, destroy only'
    },
    {
      name: 'an empty id',
      value: tab({ id: ' ' }),
      needs: 'id as a non-empty string'
    },
    {
      name: 'no title',
      value: { ...tab(), title: undefined },
      needs: 'title as a string'
    },
    {
      name: 'an icon that is not a class',
      value: { ...tab(), icon: {} },
      needs: 'icon as an icon class'
    },
    {
      name: 'no render function',
      value: { ...tab(), render: 'html' },
      needs: 'render as a function'
    },
    {
      name: 'a destroy that is not a function',
      value: { ...tab(), destroy: true },
      needs: 'destroy as a function'
    }
  ])('refuses $name, and adds nothing', ({ value, needs }) => {
    const ui = uiApi()

    expect(() => Reflect.apply(ui.addSidebarTab, ui, [value])).toThrow(
      expect.objectContaining({
        message: expect.stringContaining(
          `ui.addSidebarTab needs ${needs}, not `
        )
      })
    )
    expect(useSidebarTabStore().sidebarTabs).toEqual([])
  })
})
