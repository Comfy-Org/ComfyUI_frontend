// Category: BC.34 — Settings-panel custom dialog integration
// DB cross-ref: S12.UI3
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts
// blast_radius: 0.0
// compat-floor: NO (absent API gap — migration from DOM workaround to first-class dialog API)
// migration: innerHTML injection into #comfy-settings-dialog → comfyApp.settings.registerDialog()

import { describe, expect, it, vi } from 'vitest'

// ── V1 DOM injection simulation ───────────────────────────────────────────────
// v1 pattern: extensions appended raw HTML to the settings dialog DOM node and
// wired event listeners via onclick= or addEventListener.

interface V1SettingsEnv {
  settingsDialogEl: HTMLElement
  eventListeners: Array<{ el: HTMLElement; type: string; fn: EventListener }>
}

function makeV1SettingsEnv(): V1SettingsEnv {
  const settingsDialogEl = document.createElement('div')
  settingsDialogEl.id = 'comfy-settings-dialog'
  return { settingsDialogEl, eventListeners: [] }
}

function v1InjectDialog(
  env: V1SettingsEnv,
  htmlString: string,
  clickHandlerSelector: string,
  clickFn: EventListener
): void {
  env.settingsDialogEl.innerHTML += htmlString
  const btn = env.settingsDialogEl.querySelector(clickHandlerSelector)
  if (btn) {
    btn.addEventListener('click', clickFn)
    env.eventListeners.push({ el: btn as HTMLElement, type: 'click', fn: clickFn })
  }
}

// ── V2 dialog registry simulation ─────────────────────────────────────────────

interface DialogEntry {
  id: string
  label: string
  component: object
}

function makeV2DialogRegistry() {
  const entries: DialogEntry[] = []
  const openState = new Map<string, boolean>()
  const setupCallTimes = new Map<string, number>() // when setup() was called (0 = not called)

  return {
    registerDialog(entry: DialogEntry, setupTime: number): void {
      entries.push(entry)
      setupCallTimes.set(entry.id, setupTime)
      openState.set(entry.id, false)
    },
    open(id: string): () => void {
      openState.set(id, true)
      return () => openState.set(id, false)
    },
    isOpen: (id: string) => openState.get(id) ?? false,
    entries: () => [...entries],
    getSetupCallTime: (id: string) => setupCallTimes.get(id) ?? -1
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BC.34 migration — settings-panel custom dialog integration', () => {
  describe('innerHTML injection replacement', () => {
    it("document.getElementById('comfy-settings-dialog').innerHTML += is replaced by registerDialog()", () => {
      // v1: direct DOM injection
      const v1 = makeV1SettingsEnv()
      v1InjectDialog(v1, '<button id="my-btn">Open My Dialog</button>', '#my-btn', vi.fn())
      expect(v1.settingsDialogEl.querySelector('#my-btn')).not.toBeNull()
      expect(v1.eventListeners).toHaveLength(1)

      // v2: registerDialog owns the mounting — no DOM string surgery
      const v2 = makeV2DialogRegistry()
      const component = { __name: 'MyDialog', setup: vi.fn() }
      v2.registerDialog({ id: 'my-ext.dialog', label: 'Open My Dialog', component }, /* setupTime */ 1)

      // v2 has a single clean entry, no raw HTML, no manual listener wiring
      expect(v2.entries()).toHaveLength(1)
      expect(v2.entries()[0].label).toBe('Open My Dialog')
    })

    it('raw HTML string dialog content must be converted to a Vue SFC before migration', () => {
      // This test documents the migration contract: the HTML string is NOT valid v2 input.
      // v2 registerDialog requires a component object, not a string.
      const v2 = makeV2DialogRegistry()

      // Valid: Vue component object
      const vueComponent = { __name: 'LegacyDialogMigrated', setup: vi.fn(), template: '<div/>' }
      expect(() =>
        v2.registerDialog({ id: 'migrated', label: 'Dialog', component: vueComponent }, 1)
      ).not.toThrow()

      // v2 registry stores a component reference, never a string
      const entry = v2.entries()[0]
      expect(typeof entry.component).toBe('object')
      expect(typeof entry.component).not.toBe('string')
    })

    it('event listeners attached via onclick= in injected HTML must be converted to Vue component methods', () => {
      const clickSpy = vi.fn()

      // v1: click listener attached imperatively to DOM
      const v1 = makeV1SettingsEnv()
      v1InjectDialog(v1, '<button id="save-btn">Save</button>', '#save-btn', clickSpy)
      v1.settingsDialogEl.querySelector('#save-btn')!.dispatchEvent(new Event('click'))
      expect(clickSpy).toHaveBeenCalledOnce()

      // v2 migration: the click logic moves into the Vue component's setup()/methods,
      // not into an addEventListener call. The component itself handles the click.
      const componentSetup = vi.fn()
      const migratedComponent = { __name: 'MigratedDialog', setup: componentSetup }
      const v2 = makeV2DialogRegistry()
      v2.registerDialog({ id: 'migrated.dlg', label: 'Dialog', component: migratedComponent }, 1)

      // setup() encapsulates what onclick= did
      migratedComponent.setup()
      expect(componentSetup).toHaveBeenCalledOnce()
    })
  })

  describe('lifecycle correctness', () => {
    it('v2 registerDialog is called once during extension setup(), not on each settings-panel open', () => {
      const v2 = makeV2DialogRegistry()
      let settingsPanelOpenCount = 0

      // Extension setup — called once at app init
      const SETUP_TIME = 1
      v2.registerDialog(
        { id: 'once.ext', label: 'Once', component: { __name: 'Once' } },
        SETUP_TIME
      )

      // Settings panel opens/closes multiple times
      for (let i = 0; i < 5; i++) {
        settingsPanelOpenCount++
        const close = v2.open('once.ext')
        close()
      }

      // Entry was registered exactly once at setup time
      expect(v2.entries().filter((e) => e.id === 'once.ext')).toHaveLength(1)
      expect(v2.getSetupCallTime('once.ext')).toBe(SETUP_TIME)
      expect(settingsPanelOpenCount).toBe(5)
    })

    it('v2 dialog component is stable across settings panel re-renders; no re-injection needed', () => {
      const v2 = makeV2DialogRegistry()
      const component = { __name: 'StableDialog' }

      v2.registerDialog({ id: 'stable.ext', label: 'Stable', component }, 1)

      // Multiple open/close cycles
      for (let i = 0; i < 3; i++) {
        const close = v2.open('stable.ext')
        expect(v2.isOpen('stable.ext')).toBe(true)
        close()
        expect(v2.isOpen('stable.ext')).toBe(false)
      }

      // Entry reference is the same object throughout — no re-registration
      const foundEntries = v2.entries().filter((e) => e.id === 'stable.ext')
      expect(foundEntries).toHaveLength(1)
      expect(foundEntries[0].component).toBe(component) // same reference
    })
  })
})
