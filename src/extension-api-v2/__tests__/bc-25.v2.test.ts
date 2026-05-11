/**
 * BC.25 — Shell UI registration (commands, sidebars, toasts) [v2 contract]
 *
 * Pattern: S12.UI1 — declarative shell-UI contributions through the typed
 * ExtensionManager surface.
 *
 * V2 contract:
 *   extensionManager.registerSidebarTab(tab: SidebarTabExtension)
 *   extensionManager.command.execute(id, options?)
 *   extensionManager.toast.add(message: ToastMessageOptions)
 *
 * Phase A: tests assert interface shapes via synthetic fixtures.
 * Phase B upgrade: integrate with runV2() once the eval sandbox lands.
 *
 * DB cross-ref: S12.UI1
 */
import { describe, it, expect, vi } from 'vitest'

import { loadEvidenceSnippet, runV1, runV2 } from '@/extension-api-v2/harness'
import type {
  ExtensionManager,
  SidebarTabExtension,
  ToastMessageOptions,
} from '@/types/extensionTypes'

void [loadEvidenceSnippet, runV1, runV2]

// ─── Synthetic ExtensionManager fixture ──────────────────────────────────────

function makeExtensionManager(): ExtensionManager & {
  _tabs: SidebarTabExtension[]
  _toasts: ToastMessageOptions[]
  _executed: Array<{ command: string; options?: unknown }>
} {
  const tabs: SidebarTabExtension[] = []
  const toasts: ToastMessageOptions[] = []
  const executed: Array<{ command: string; options?: unknown }> = []

  return {
    registerSidebarTab(tab: SidebarTabExtension) { tabs.push(tab) },
    unregisterSidebarTab(id: string) {
      const idx = tabs.findIndex(t => t.id === id)
      if (idx !== -1) tabs.splice(idx, 1)
    },
    getSidebarTabs() { return [...tabs] },

    toast: {
      add(msg: ToastMessageOptions) { toasts.push(msg) },
      remove(msg: ToastMessageOptions) {
        const idx = toasts.indexOf(msg)
        if (idx !== -1) toasts.splice(idx, 1)
      },
      removeAll() { toasts.length = 0 },
    },

    command: {
      commands: [],
      execute(command: string, options?: unknown) {
        executed.push({ command, options })
      },
    },

    dialog: {} as ExtensionManager['dialog'],
    setting: {
      get: () => undefined,
      set: () => {},
    },
    workflow: {} as ExtensionManager['workflow'],
    lastNodeErrors: null,
    lastExecutionError: null,
    renderMarkdownToHtml: (md: string) => md,

    get _tabs() { return tabs },
    get _toasts() { return toasts },
    get _executed() { return executed },
  } as unknown as ExtensionManager & {
    _tabs: SidebarTabExtension[]
    _toasts: ToastMessageOptions[]
    _executed: Array<{ command: string; options?: unknown }>
  }
}

// ─── S12.UI1 — registerSidebarTab ────────────────────────────────────────────

describe('BC.25 — Shell UI registration [v2 contract] — registerSidebarTab', () => {
  it('registerSidebarTab adds a tab retrievable by getSidebarTabs', () => {
    const mgr = makeExtensionManager()
    const tab: SidebarTabExtension = {
      id: 'my-ext.panel',
      title: 'My Panel',
      icon: 'pi pi-star',
      type: 'custom',
      render: (_container: HTMLElement) => {},
    }

    mgr.registerSidebarTab(tab)

    const tabs = mgr.getSidebarTabs()
    expect(tabs).toHaveLength(1)
    expect(tabs[0].id).toBe('my-ext.panel')
    expect(tabs[0].title).toBe('My Panel')
  })

  it('unregisterSidebarTab removes the tab by id', () => {
    const mgr = makeExtensionManager()
    const tab: SidebarTabExtension = {
      id: 'ext.removable',
      title: 'Removable',
      type: 'custom',
      render: (_c: HTMLElement) => {},
    }
    mgr.registerSidebarTab(tab)
    expect(mgr.getSidebarTabs()).toHaveLength(1)

    mgr.unregisterSidebarTab('ext.removable')
    expect(mgr.getSidebarTabs()).toHaveLength(0)
  })

  it('multiple tabs can be registered independently', () => {
    const mgr = makeExtensionManager()
    const makeTab = (id: string): SidebarTabExtension => ({
      id,
      title: id,
      type: 'custom',
      render: (_c: HTMLElement) => {},
    })

    mgr.registerSidebarTab(makeTab('ext.a'))
    mgr.registerSidebarTab(makeTab('ext.b'))
    mgr.registerSidebarTab(makeTab('ext.c'))

    expect(mgr.getSidebarTabs()).toHaveLength(3)
  })
})

// ─── S12.UI1 — command.execute ───────────────────────────────────────────────

describe('BC.25 — Shell UI registration [v2 contract] — command.execute', () => {
  it('execute records the command id', () => {
    const mgr = makeExtensionManager()
    mgr.command.execute('Comfy.QueuePrompt')
    expect(mgr._executed).toHaveLength(1)
    expect(mgr._executed[0].command).toBe('Comfy.QueuePrompt')
  })

  it('execute passes through options', () => {
    const mgr = makeExtensionManager()
    const opts = { errorHandler: vi.fn() }
    mgr.command.execute('Comfy.ClearWorkflow', opts)
    expect(mgr._executed[0].options).toBe(opts)
  })

  it('execute can be called multiple times', () => {
    const mgr = makeExtensionManager()
    mgr.command.execute('A')
    mgr.command.execute('B')
    mgr.command.execute('C')
    expect(mgr._executed.map(e => e.command)).toEqual(['A', 'B', 'C'])
  })
})

// ─── S12.UI1 — toast.add ─────────────────────────────────────────────────────

describe('BC.25 — Shell UI registration [v2 contract] — toast.add', () => {
  it('toast.add queues a message with severity and summary', () => {
    const mgr = makeExtensionManager()
    mgr.toast.add({ severity: 'info', summary: 'Loaded', life: 3000 })

    expect(mgr._toasts).toHaveLength(1)
    expect(mgr._toasts[0].severity).toBe('info')
    expect(mgr._toasts[0].summary).toBe('Loaded')
  })

  it('toast.add supports error severity with detail', () => {
    const mgr = makeExtensionManager()
    mgr.toast.add({ severity: 'error', summary: 'Failed', detail: 'Node not found' })

    expect(mgr._toasts[0].severity).toBe('error')
    expect(mgr._toasts[0].detail).toBe('Node not found')
  })

  it('toast.removeAll clears all queued messages', () => {
    const mgr = makeExtensionManager()
    mgr.toast.add({ severity: 'info', summary: 'A' })
    mgr.toast.add({ severity: 'warn', summary: 'B' })
    mgr.toast.removeAll()

    expect(mgr._toasts).toHaveLength(0)
  })
})
