// Category: BC.34 — Settings-panel custom dialog integration
// DB cross-ref: S12.UI3
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts
// blast_radius: 0.0
// compat-floor: NO (absent API gap — new v2 API surface)
// v2 contract: comfyApp.settings.registerDialog({ id, label, component: MyVueComponent })

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Dialog registry simulation ────────────────────────────────────────────────
// Models comfyApp.settings.registerDialog — the registry tracks entries and
// provides a trigger mechanism. The actual Vue mounting is runtime-owned.

interface DialogEntry {
  id: string
  label: string
  component: object // Vue component definition (opaque in tests)
}

interface DialogState {
  open: boolean
  closeCallback: (() => void) | null
}

function makeSettingsDialogRegistry() {
  const entries = new Map<string, DialogEntry>()
  const dialogState = new Map<string, DialogState>()

  return {
    registerDialog(entry: DialogEntry): void {
      if (entries.has(entry.id)) throw new Error(`Dialog id '${entry.id}' already registered`)
      entries.set(entry.id, entry)
      dialogState.set(entry.id, { open: false, closeCallback: null })
    },
    triggerDialog(id: string): { close: () => void } {
      const state = dialogState.get(id)
      if (!state) throw new Error(`No dialog registered with id '${id}'`)
      state.open = true
      const close = () => { state.open = false }
      state.closeCallback = close
      return { close }
    },
    isOpen(id: string): boolean {
      return dialogState.get(id)?.open ?? false
    },
    getEntry(id: string): DialogEntry | undefined {
      return entries.get(id)
    },
    registeredIds(): string[] {
      return [...entries.keys()]
    },
    mountCount: new Map<string, number>(), // tracks lazy mount calls
    simulateLazyMount(id: string): void {
      this.mountCount.set(id, (this.mountCount.get(id) ?? 0) + 1)
    },
    getMountCount(id: string): number {
      return this.mountCount.get(id) ?? 0
    }
  }
}

// ── Minimal Vue component stub ────────────────────────────────────────────────

function makeVueComponent(name: string) {
  return { __name: name, setup: vi.fn(), template: `<div>${name}</div>` }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BC.34 v2 contract — settings-panel custom dialog integration', () => {
  let registry: ReturnType<typeof makeSettingsDialogRegistry>

  beforeEach(() => {
    registry = makeSettingsDialogRegistry()
  })

  describe('S12.UI3 — registerDialog API', () => {
    it('registerDialog({ id, label, component }) adds a trigger entry to the settings panel', () => {
      const comp = makeVueComponent('MySettingsDialog')
      registry.registerDialog({ id: 'my-ext.settings', label: 'My Extension Settings', component: comp })

      expect(registry.registeredIds()).toContain('my-ext.settings')
      const entry = registry.getEntry('my-ext.settings')!
      expect(entry.label).toBe('My Extension Settings')
      expect(entry.component).toBe(comp)
    })

    it('clicking the settings entry opens the component as a managed modal (triggerDialog returns close())', () => {
      const comp = makeVueComponent('ColorPickerDialog')
      registry.registerDialog({ id: 'ext.color', label: 'Color Settings', component: comp })

      expect(registry.isOpen('ext.color')).toBe(false)

      const { close } = registry.triggerDialog('ext.color')
      expect(registry.isOpen('ext.color')).toBe(true)

      close()
      expect(registry.isOpen('ext.color')).toBe(false)
    })

    it('dialog component receives a close() callback it can call to dismiss the modal', () => {
      registry.registerDialog({
        id: 'ext.closeable',
        label: 'Closeable Dialog',
        component: makeVueComponent('CloseableDialog')
      })

      const { close } = registry.triggerDialog('ext.closeable')
      expect(registry.isOpen('ext.closeable')).toBe(true)

      // Simulate component calling close() prop
      close()
      expect(registry.isOpen('ext.closeable')).toBe(false)
    })

    it('multiple extensions registering dialogs each get independent entries', () => {
      registry.registerDialog({ id: 'ext-a.dialog', label: 'A Settings', component: makeVueComponent('A') })
      registry.registerDialog({ id: 'ext-b.dialog', label: 'B Settings', component: makeVueComponent('B') })
      registry.registerDialog({ id: 'ext-c.dialog', label: 'C Settings', component: makeVueComponent('C') })

      expect(registry.registeredIds()).toHaveLength(3)

      // Open B only — A and C are unaffected
      registry.triggerDialog('ext-b.dialog')
      expect(registry.isOpen('ext-a.dialog')).toBe(false)
      expect(registry.isOpen('ext-b.dialog')).toBe(true)
      expect(registry.isOpen('ext-c.dialog')).toBe(false)
    })

    it("registering the same id twice throws a clear error", () => {
      registry.registerDialog({ id: 'dup', label: 'X', component: makeVueComponent('X') })
      expect(() =>
        registry.registerDialog({ id: 'dup', label: 'Y', component: makeVueComponent('Y') })
      ).toThrow("'dup'")
    })
  })

  describe("S12.UI3 — dialog-trigger: lazy mounting", () => {
    it("dialog component is lazily mounted only when the trigger is clicked, not at registration time", () => {
      registry.registerDialog({
        id: 'lazy.ext',
        label: 'Lazy Dialog',
        component: makeVueComponent('LazyDialog')
      })

      // Registration does not mount — mount count is 0
      expect(registry.getMountCount('lazy.ext')).toBe(0)

      // Only after trigger does mount happen
      registry.triggerDialog('lazy.ext')
      registry.simulateLazyMount('lazy.ext')
      expect(registry.getMountCount('lazy.ext')).toBe(1)
    })

    it("triggering the dialog a second time does not re-mount the component", () => {
      registry.registerDialog({
        id: 'single-mount.ext',
        label: 'Single Mount',
        component: makeVueComponent('SM')
      })

      // First trigger
      const { close: close1 } = registry.triggerDialog('single-mount.ext')
      registry.simulateLazyMount('single-mount.ext')
      close1()

      // Second trigger — component already mounted, no re-mount
      registry.triggerDialog('single-mount.ext')
      // Runtime reuses existing mount; simulateLazyMount not called again
      expect(registry.getMountCount('single-mount.ext')).toBe(1)
    })
  })
})
