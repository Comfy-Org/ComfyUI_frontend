/**
 * BC.25 — Shell UI registration (commands, sidebars, toasts) [v1 → v2 migration]
 *
 * Pattern: S12.UI1
 *
 * Migration table:
 *   v1: app.extensionManager.registerSidebarTab(tab)
 *       → v2: extensionManager.registerSidebarTab(tab)  (typed, same shape)
 *   v1: app.extensionManager.commands.execute(id)
 *       → v2: extensionManager.command.execute(id, options?)
 *   v1: useToastStore().add({ severity, summary, detail })
 *       → v2: extensionManager.toast.add({ severity, summary, detail })
 *
 * Phase A: synthetic fixtures. Phase B: loadEvidenceSnippet().
 *
 * DB cross-ref: S12.UI1
 */
import { describe, it, expect } from 'vitest'

import { loadEvidenceSnippet, runV1, runV2 } from '@/extension-api-v2/harness'
import type {
  ExtensionManager,
  SidebarTabExtension,
  ToastMessageOptions,
} from '@/types/extensionTypes'

void [loadEvidenceSnippet, runV1, runV2]

// ─── Fixtures ────────────────────────────────────────────────────────────────

interface V1AppShell {
  extensionManager: {
    sidebarTabs: SidebarTabExtension[]
    registerSidebarTab(tab: SidebarTabExtension): void
  }
  toast: { add(msg: ToastMessageOptions): void; _queue: ToastMessageOptions[] }
  executedCommands: string[]
}

function makeV1Shell(): V1AppShell {
  const sidebarTabs: SidebarTabExtension[] = []
  const toastQueue: ToastMessageOptions[] = []
  const executedCommands: string[] = []
  return {
    extensionManager: {
      sidebarTabs,
      registerSidebarTab(tab: SidebarTabExtension) { sidebarTabs.push(tab) },
    },
    toast: {
      _queue: toastQueue,
      add(msg: ToastMessageOptions) { toastQueue.push(msg) },
    },
    executedCommands,
  }
}

function makeV2Manager(): ExtensionManager & {
  _tabs: SidebarTabExtension[]
  _toasts: ToastMessageOptions[]
  _executed: string[]
} {
  const tabs: SidebarTabExtension[] = []
  const toasts: ToastMessageOptions[] = []
  const executed: string[] = []
  return {
    registerSidebarTab(tab: SidebarTabExtension) { tabs.push(tab) },
    unregisterSidebarTab(id: string) {
      const i = tabs.findIndex(t => t.id === id)
      if (i !== -1) tabs.splice(i, 1)
    },
    getSidebarTabs: () => [...tabs],
    toast: {
      add(msg: ToastMessageOptions) { toasts.push(msg) },
      remove: () => {},
      removeAll: () => { toasts.length = 0 },
    },
    command: {
      commands: [],
      execute(id: string) { executed.push(id) },
    },
    dialog: {} as ExtensionManager['dialog'],
    setting: { get: () => undefined, set: () => {} },
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
    _executed: string[]
  }
}

// ─── S12.UI1 migration tests ─────────────────────────────────────────────────

describe('BC.25 [migration] — S12.UI1: registerSidebarTab', () => {
  it('v1 and v2 registerSidebarTab produce the same registered tab id', () => {
    const tab: SidebarTabExtension = {
      id: 'ext.my-panel',
      title: 'My Panel',
      type: 'custom',
      render: (_c: HTMLElement) => {},
    }

    const v1 = makeV1Shell()
    v1.extensionManager.registerSidebarTab(tab)

    const v2 = makeV2Manager()
    v2.registerSidebarTab(tab)

    expect(v1.extensionManager.sidebarTabs[0].id).toBe(v2._tabs[0].id)
  })

  it('v2 registerSidebarTab accepts the same tab shape as v1', () => {
    // The SidebarTabExtension type is unchanged between v1 and v2 app shell.
    // Migration cost is only the import source, not the API shape.
    const tab: SidebarTabExtension = {
      id: 'ext.panel',
      title: 'Panel',
      icon: 'pi pi-image',
      type: 'custom',
      render: (_c: HTMLElement) => {},
    }
    const v2 = makeV2Manager()
    // Should not throw or require adaptation
    expect(() => v2.registerSidebarTab(tab)).not.toThrow()
    expect(v2._tabs[0].title).toBe('Panel')
  })
})

describe('BC.25 [migration] — S12.UI1: toast.add', () => {
  it('v1 useToastStore().add and v2 extensionManager.toast.add accept the same message shape', () => {
    const message: ToastMessageOptions = {
      severity: 'success',
      summary: 'Workflow saved',
      life: 2000,
    }

    const v1 = makeV1Shell()
    v1.toast.add(message)

    const v2 = makeV2Manager()
    v2.toast.add(message)

    expect(v1.toast._queue[0]).toEqual(v2._toasts[0])
  })
})

describe('BC.25 [migration] — S12.UI1: command.execute', () => {
  it('v2 extensionManager.command.execute replaces direct app.queue() calls', () => {
    // v1 pattern: app.queuePrompt() / direct invocation
    // v2 pattern: extensionManager.command.execute('Comfy.QueuePrompt')
    const v2 = makeV2Manager()
    v2.command.execute('Comfy.QueuePrompt')
    expect(v2._executed).toContain('Comfy.QueuePrompt')
  })
})
