/**
 * Per-surface shell UI registration entry points
 *.
 *
 * Each `defineX` function in this module is the v2 replacement for one slot
 * of the v1 `app.registerExtension({ commands, keybindings, settings, … })`
 * mega-call. Per the ACCEPTED PICK (option (ii) "separate entries" with an
 * inline-imperative carve-out for `toast` / `notify`), each surface gets its
 * own typed, per-import-testable, independently disposable entry point.
 *
 * ## Dispose contract
 *
 * Every `defineX` returns a `{ dispose(): void }` handle:
 *
 * - **Idempotent**: calling `dispose()` more than once is safe and is a no-op
 *   after the first call.
 * - **Synchronous teardown**: the actual unregister-from-store happens
 *   synchronously inside `dispose()` (no async cleanup).
 * - **Ordering on multi-surface extensions**: dispose handles are
 *   independent. If you hold handles A, B, C from three `defineX` calls and
 *   call `A.dispose()`, B and C are unaffected. Callers that need ordered
 *   teardown (e.g. drop the hotkey before its command) should sequence
 *   `dispose()` calls explicitly.
 * - **Pre-mount dispose**: if `dispose()` is called before the runtime has
 *   started the extension system (and thus before the spec has been wired
 *   into the underlying store), the spec is removed from the pending queue
 *   and never reaches the store.
 *
 * ## Lazy mount + queue-then-flush pattern
 *
 * Each `defineX` is safe to call at module-evaluation time — i.e. before
 * Pinia is initialized and before any store is reachable. The spec is
 * pushed onto a per-surface pending queue; the runtime flushes the queue
 * via {@link _flushShellRegistrations} once `startExtensionSystem()` runs
 * during app bootstrap. After flush, subsequent `defineX` calls mount
 * immediately.
 *
 * This mirrors the existing `defineExtension` / `defineNode` / `defineWidget`
 * pattern in `@/services/extension-api-service` (they also push onto
 * module-level arrays that bootstrap drains later).
 *
 * @packageDocumentation
 */

import type {
  AboutBadgeExtension,
  BottomPanelExtension,
  CommandDefinition,
  HotkeyExtension,
  SettingDefinition,
  SidebarTabExtension,
  ToolbarButtonExtension
} from '@/types/extensionTypes'

/**
 * Handle returned by every `defineX`. Call `dispose()` to remove the
 * registration. Idempotent and synchronous — see module-level "Dispose
 * contract" notes.
 *
 * @publicAPI
 * @stability experimental
 */
export interface DisposableHandle {
  dispose(): void
}

// Internal mount-queue infrastructure
/**
 * Registration side effect: registers something into a store and returns a
 * cleanup. May be async (most registrations dynamic-import their store at
 * runtime to defer Pinia coupling to bootstrap time).
 *
 * @internal
 */
type CleanupFn = () => void
type Mounter = () => CleanupFn | void | Promise<CleanupFn | void>

interface PendingEntry {
  mount: Mounter
  cleanup: CleanupFn | null
  disposed: boolean
}

const pendingEntries: PendingEntry[] = []
let _systemStarted = false

/**
 * Run a mounter and capture its cleanup (sync or async). Async failures are
 * surfaced loudly in dev, swallowed in prod.
 *
 * @internal
 */
function runMounter(entry: PendingEntry): void {
  try {
    const result = entry.mount()
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      void (result as Promise<CleanupFn | void>).then(
        (cleanup) => {
          if (entry.disposed) {
            // Already disposed before async mount resolved — invoke the cleanup
            // immediately to avoid a leak.
            if (cleanup) {
              try {
                cleanup()
              } catch {
                /* swallow */
              }
            }
            return
          }
          entry.cleanup = cleanup ?? null
        },
        (err) => {
          if (import.meta.env.DEV) {
            console.error('[extension-api] defineX mount failed:', err)
          } else {
            console.warn('[extension-api] defineX mount failed:', err)
          }
        }
      )
    } else {
      entry.cleanup = (result as CleanupFn | void) ?? null
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[extension-api] defineX mount failed:', err)
    } else {
      console.warn('[extension-api] defineX mount failed:', err)
    }
  }
}

/**
 * Push a mount-fn onto the pending queue, returning a disposable handle.
 * If the system is already started, mount immediately.
 *
 * @internal
 */
function register(mount: Mounter): DisposableHandle {
  const entry: PendingEntry = { mount, cleanup: null, disposed: false }
  pendingEntries.push(entry)

  if (_systemStarted) {
    runMounter(entry)
  }

  return {
    dispose() {
      if (entry.disposed) return
      entry.disposed = true
      if (entry.cleanup) {
        try {
          entry.cleanup()
        } catch (err) {
          if (import.meta.env.DEV) {
            console.error('[extension-api] defineX dispose failed:', err)
          }
        }
        entry.cleanup = null
      }
    }
  }
}

/**
 * Flush all pending shell-UI registrations. Called by
 * `startExtensionSystem()` once Pinia and the underlying stores are ready.
 *
 * Idempotent: subsequent calls re-flush only entries that have not yet
 * been mounted (allowing `defineX` calls made after start to mount lazily
 * via the `_systemStarted` flag in {@link register}).
 *
 * @internal
 */
export function _flushShellRegistrations(): void {
  _systemStarted = true
  for (const entry of pendingEntries) {
    if (entry.disposed || entry.cleanup) continue
    runMounter(entry)
  }
}

/** @internal Test-only: drop all pending registrations and reset state. */
export function _clearShellRegistrationsForTesting(): void {
  for (const entry of pendingEntries) {
    if (entry.cleanup) {
      try {
        entry.cleanup()
      } catch {
        /* ignore */
      }
    }
  }
  pendingEntries.length = 0
  _systemStarted = false
}

// Public defineX entry points
/**
 * Register a sidebar tab. Returns a {@link DisposableHandle} — call
 * `handle.dispose()` to remove the tab.
 *
 * The tab spec is a thin POJO (see {@link SidebarTabExtension}); the runtime
 * mounts it via the workspace sidebar-tab store at app bootstrap time. May
 * be called at module-evaluation time; mount is deferred until the system
 * starts.
 *
 * @publicAPI
 * @stability experimental
 * @example
 * ```ts
 * import { defineSidebarTab } from '@comfyorg/extension-api'
 *
 * const tab = defineSidebarTab({
 *   id: 'my-tab',
 *   title: 'My Tab',
 *   type: 'vue',
 *   component: MyTabComponent
 * })
 *
 * // Later: remove the tab
 * tab.dispose()
 * ```
 */
export function defineSidebarTab(opts: SidebarTabExtension): DisposableHandle {
  return register(async () => {
    const { useSidebarTabStore } =
      await import('@/stores/workspace/sidebarTabStore')
    const store = useSidebarTabStore()
    store.registerSidebarTab(opts)
    return () => store.unregisterSidebarTab(opts.id)
  })
}

/**
 * Register a bottom-panel tab. Returns a {@link DisposableHandle} — call
 * `handle.dispose()` to remove the tab.
 *
 * @publicAPI
 * @stability experimental
 * @example
 * ```ts
 * import { defineBottomPanelTab } from '@comfyorg/extension-api'
 *
 * defineBottomPanelTab({
 *   id: 'my-logs',
 *   title: 'My Logs',
 *   type: 'vue',
 *   component: MyLogsComponent
 * })
 * ```
 */
export function defineBottomPanelTab(
  opts: BottomPanelExtension
): DisposableHandle {
  return register(async () => {
    const { useBottomPanelStore } =
      await import('@/stores/workspace/bottomPanelStore')
    const store = useBottomPanelStore()
    store.registerBottomPanelTab(opts)
    // bottomPanelStore exposes no unregister API today; remove from the
    // reactive list manually. Filed as follow-up when the store gains a
    // first-class `unregisterBottomPanelTab(id)`.
    return () => {
      const idx = store.bottomPanelTabs.findIndex((t) => t.id === opts.id)
      if (idx >= 0) store.bottomPanelTabs.splice(idx, 1)
    }
  })
}

/**
 * Register a command. Returns a {@link DisposableHandle} — call
 * `handle.dispose()` to unregister the command.
 *
 * @publicAPI
 * @stability experimental
 * @example
 * ```ts
 * import { defineCommand } from '@comfyorg/extension-api'
 *
 * defineCommand({
 *   id: 'my-org.my-command',
 *   label: 'Do The Thing',
 *   function: () => { console.log('doing the thing') }
 * })
 * ```
 */
export function defineCommand(opts: CommandDefinition): DisposableHandle {
  return register(async () => {
    const { useCommandStore } = await import('@/stores/commandStore')
    const store = useCommandStore()
    store.registerCommand(opts)
    // commandStore lacks an `unregisterCommand` API today; delete the entry
    // from its internal map via best-effort. Follow-up to add a first-class
    // unregister method.
    return () => {
      const cmds = store.commands as unknown as Array<{ id: string }>
      const idx = cmds.findIndex((c) => c.id === opts.id)
      if (idx >= 0) cmds.splice(idx, 1)
    }
  })
}

/**
 * Register a hotkey binding. Returns a {@link DisposableHandle} — call
 * `handle.dispose()` to unbind.
 *
 * The hotkey targets a command id; register the command separately via
 * {@link defineCommand}. The `keys` string is parsed via the standard
 * key-combo grammar (`mod+k`, `ctrl+shift+f`, etc.).
 *
 * @publicAPI
 * @stability experimental
 * @example
 * ```ts
 * import { defineCommand, defineHotkey } from '@comfyorg/extension-api'
 *
 * defineCommand({ id: 'my.cmd', function: () => {} })
 * defineHotkey({ keys: 'mod+k', commandId: 'my.cmd' })
 * ```
 */
export function defineHotkey(opts: HotkeyExtension): DisposableHandle {
  return register(async () => {
    const [{ useKeybindingStore }, { KeybindingImpl }] = await Promise.all([
      import('@/platform/keybindings/keybindingStore'),
      import('@/platform/keybindings/keybinding')
    ])
    const store = useKeybindingStore()
    const combo = parseKeyComboString(opts.keys)
    const kb = new KeybindingImpl({
      commandId: opts.commandId,
      combo,
      targetElementId: opts.targetElementId
    })
    store.addDefaultKeybinding(kb)
    // keybindingStore has no first-class unbind for default keybindings;
    // remove the combo from the reactive map directly.
    return () => {
      const target = (
        store as unknown as {
          defaultKeybindings: { value: Record<string, unknown> }
        }
      ).defaultKeybindings
      if (target?.value) {
        const key = kb.combo.serialize()
        const next = { ...target.value }
        delete next[key]
        target.value = next
      }
    }
  })
}

/**
 * Parse `'mod+shift+k'` → `{ key: 'k', ctrl: true (or meta on mac), shift: true }`.
 * Matches the convention used by the keybinding store.
 *
 * @internal
 */
function parseKeyComboString(input: string): {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
} {
  const parts = input.split('+').map((p) => p.trim().toLowerCase())
  const isMac =
    typeof navigator !== 'undefined' &&
    /mac|iphone|ipad|ipod/i.test(navigator.platform)
  const result: {
    key: string
    ctrl?: boolean
    alt?: boolean
    shift?: boolean
    meta?: boolean
  } = { key: '' }
  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') result.ctrl = true
    else if (part === 'alt' || part === 'option') result.alt = true
    else if (part === 'shift') result.shift = true
    else if (part === 'meta' || part === 'cmd' || part === 'command')
      result.meta = true
    else if (part === 'mod') {
      if (isMac) result.meta = true
      else result.ctrl = true
    } else {
      result.key = part
    }
  }
  return result
}

/**
 * Register a setting. Returns a {@link DisposableHandle} — call
 * `handle.dispose()` to remove the setting from the settings menu.
 *
 * @publicAPI
 * @stability experimental
 * @example
 * ```ts
 * import { defineSetting } from '@comfyorg/extension-api'
 *
 * defineSetting({
 *   id: 'my.option' as never,    // widen until Settings is augmented
 *   name: 'My Option',
 *   type: 'boolean',
 *   defaultValue: false
 * })
 * ```
 */
export function defineSetting<TValue = unknown>(
  opts: SettingDefinition<TValue>
): DisposableHandle {
  // The underlying SettingParams<TValue> is invariant in TValue inside the
  // store; widen to `unknown` at the boundary so the typed public arg accepts
  // any TValue without forcing every internal store to be generic.
  const widened = opts as unknown as SettingDefinition<unknown>
  return register(async () => {
    const { useSettingStore } = await import('@/platform/settings/settingStore')
    const store = useSettingStore()
    store.addSetting(widened)
    // settingStore has no removeSetting API today; clear via direct map
    // mutation. Follow-up to add a first-class remove.
    return () => {
      const settingsById = (
        store as unknown as { settingsById?: Record<string, unknown> }
      ).settingsById
      if (settingsById && opts.id in settingsById) {
        delete settingsById[opts.id]
      }
    }
  })
}

/**
 * Register an About-page badge. Returns a {@link DisposableHandle} — call
 * `handle.dispose()` to remove the badge.
 *
 * @publicAPI
 * @stability experimental
 * @example
 * ```ts
 * import { defineAboutBadge } from '@comfyorg/extension-api'
 *
 * defineAboutBadge({
 *   label: 'GitHub',
 *   url: 'https://github.com/me/my-ext',
 *   icon: 'pi-github'
 * })
 * ```
 */
export function defineAboutBadge(opts: AboutBadgeExtension): DisposableHandle {
  // The aboutPanelStore today computes its badge list reactively from
  // `extensionStore.extensions.flatMap(e => e.aboutPageBadges ?? [])`. There
  // is no direct register API yet. We push into a module-level array that
  // the aboutPanelStore will consume after a follow-up wires it in (P5.E).
  // Until then, the call still registers a dispose-aware entry so author
  // code is forward-compatible.
  const entry = { ...opts }
  _aboutBadgeRegistry.push(entry)
  return register(() => {
    return () => {
      const idx = _aboutBadgeRegistry.indexOf(entry)
      if (idx >= 0) _aboutBadgeRegistry.splice(idx, 1)
    }
  })
}

/**
 * Internal registry for badges registered via {@link defineAboutBadge}.
 * Consumed by the about-panel store wiring (P5.E follow-up).
 *
 * @internal
 */
export const _aboutBadgeRegistry: AboutBadgeExtension[] = []

/**
 * Register a toolbar button (action-bar button). Returns a
 * {@link DisposableHandle} — call `handle.dispose()` to remove the button.
 *
 * **Net-new surface**: no v1 registration path existed. Authors using this
 * are first-movers; the API may evolve before stabilizing.
 *
 * @publicAPI
 * @stability experimental
 * @example
 * ```ts
 * import { defineToolbarButton } from '@comfyorg/extension-api'
 *
 * defineToolbarButton({
 *   id: 'my.help',
 *   icon: 'pi-question-circle',
 *   tooltip: 'Get help',
 *   onClick: () => openHelp()
 * })
 * ```
 */
export function defineToolbarButton(
  opts: ToolbarButtonExtension
): DisposableHandle {
  // The action-bar today renders from `extensionStore.extensions.flatMap(e =>
  // e.actionBarButtons ?? [])`. As with defineAboutBadge, the v2 path uses a
  // module-level registry that the action-bar component will consume after
  // a follow-up wires it in (P5.E).
  const entry = { ...opts }
  _toolbarButtonRegistry.push(entry)
  return register(() => {
    return () => {
      const idx = _toolbarButtonRegistry.indexOf(entry)
      if (idx >= 0) _toolbarButtonRegistry.splice(idx, 1)
    }
  })
}

/**
 * Internal registry for buttons registered via {@link defineToolbarButton}.
 * Consumed by the action-bar component wiring (P5.E follow-up).
 *
 * @internal
 */
export const _toolbarButtonRegistry: ToolbarButtonExtension[] = []
