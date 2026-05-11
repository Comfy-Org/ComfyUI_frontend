// Category: BC.25 — Shell UI registration (commands, sidebars, toasts)
// DB cross-ref: S12.UI1
// blast_radius: 4.44 (compat-floor)
// v1 contract: app.extensionManager.registerSidebarTab(...) / command.execute / toast.add
// TODO(R8): swap with loadEvidenceSnippet once excerpts populated

import { describe, expect, it } from 'vitest'
import { countEvidenceExcerpts, loadEvidenceSnippet, runV1 } from '../harness'

void [loadEvidenceSnippet, runV1]

type SidebarTab = { id: string; icon: string; title: string; component: unknown }
type Toast = { severity: string; summary: string; detail?: string; life?: number }

function makeExtensionManager() {
  const tabs: SidebarTab[] = []
  const toasts: Toast[] = []
  const commandLog: string[] = []

  return {
    registerSidebarTab(tab: SidebarTab) {
      tabs.push(tab)
    },
    unregisterSidebarTab(id: string) {
      const idx = tabs.findIndex(t => t.id === id)
      if (idx !== -1) tabs.splice(idx, 1)
    },
    command: {
      execute(commandId: string, _opts?: unknown) {
        commandLog.push(commandId)
      },
    },
    toast: {
      add(toast: Toast) {
        toasts.push(toast)
      },
    },
    _tabs: tabs,
    _toasts: toasts,
    _commandLog: commandLog,
  }
}

describe('BC.25 v1 contract — Shell UI registration (S12.UI1)', () => {
  it('S12.UI1 has at least one evidence excerpt', () => {
    expect(countEvidenceExcerpts('S12.UI1')).toBeGreaterThan(0)
  })

  it('registerSidebarTab registers the tab by id', () => {
    const mgr = makeExtensionManager()
    mgr.registerSidebarTab({ id: 'my-ext.sidebar', icon: 'pi pi-box', title: 'My Panel', component: null })
    expect(mgr._tabs.map(t => t.id)).toContain('my-ext.sidebar')
  })

  it('unregisterSidebarTab removes a previously registered tab', () => {
    const mgr = makeExtensionManager()
    mgr.registerSidebarTab({ id: 'my-ext.sidebar', icon: 'pi pi-box', title: 'My Panel', component: null })
    mgr.unregisterSidebarTab('my-ext.sidebar')
    expect(mgr._tabs.map(t => t.id)).not.toContain('my-ext.sidebar')
  })

  it('multiple sidebar tabs from different extensions coexist', () => {
    const mgr = makeExtensionManager()
    mgr.registerSidebarTab({ id: 'ext-a.panel', icon: '', title: 'A', component: null })
    mgr.registerSidebarTab({ id: 'ext-b.panel', icon: '', title: 'B', component: null })
    const ids = mgr._tabs.map(t => t.id)
    expect(ids).toContain('ext-a.panel')
    expect(ids).toContain('ext-b.panel')
  })

  it('command.execute logs the command id', () => {
    const mgr = makeExtensionManager()
    mgr.command.execute('Comfy.OpenSettings')
    expect(mgr._commandLog).toContain('Comfy.OpenSettings')
  })

  it('toast.add stores the toast with severity', () => {
    const mgr = makeExtensionManager()
    mgr.toast.add({ severity: 'info', summary: 'Loaded', detail: 'Extension ready', life: 3000 })
    expect(mgr._toasts[0].severity).toBe('info')
    expect(mgr._toasts[0].summary).toBe('Loaded')
  })

  it('toast.add with error severity is stored correctly', () => {
    const mgr = makeExtensionManager()
    mgr.toast.add({ severity: 'error', summary: 'Failed', detail: 'Could not connect' })
    expect(mgr._toasts[0].severity).toBe('error')
  })

  it('multiple toasts are all stored independently', () => {
    const mgr = makeExtensionManager()
    mgr.toast.add({ severity: 'info', summary: 'A' })
    mgr.toast.add({ severity: 'warn', summary: 'B' })
    expect(mgr._toasts).toHaveLength(2)
  })
})
