/**
 * `comfy.ui` — the sanctioned slice of app chrome a pack may add to.
 *
 * Sidebar tabs are the whole point of several packs rather than a decoration:
 * Crystools' resource monitor exists to be a sidebar tab, and mtb's
 * input/output browser is one file that is entirely `registerSidebarTab`.
 * Without this they are not degraded, they are pointless.
 *
 * A tab is either a Vue component or a container the pack draws into. Both are
 * first class. This frontend is a Vue application and the API is built on that
 * rather than around it, so a pack that already builds with Vite should pass a
 * component and keep reactivity, scoped styles and `onUnmounted`; a pack
 * shipping hand-written ES modules with no build step passes `render`.
 *
 * The shape is still a projection of the host's `SidebarTabExtension` rather
 * than a re-export of it: that type also carries `iconBadge` and `label`,
 * which are core's business, and publishing it wholesale would pin an internal
 * shape into the public contract.
 *
 * `render`/`destroy` mirror `widgets.mount`, so a pack that can mount a widget
 * already knows that arm. The host owns the lifecycle either way:
 * `ExtensionSlot` renders the component, or calls `render` when the tab is
 * shown and `destroy` when it is hidden — so a tab may be mounted and torn
 * down many times.
 */
import { defineComponent, h, markRaw, onMounted, onUnmounted, ref } from 'vue'
import type { Component } from 'vue'

import { ContextMenu } from '@/lib/litegraph/src/ContextMenu'
import type { IContextMenuValue } from '@/lib/litegraph/src/interfaces'
import { useDialogStore } from '@/stores/dialogStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import {
  addBadgeContribution,
  addButtonContribution
} from './chromeContributions'
import type {
  BadgeContribution,
  ButtonContribution,
  ChromeItemHandle
} from './chromeContributions'
import { ComfyApiError } from './errors'
import type { Unsubscribe } from './widgetHandle'

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SidebarTabBase {
  /**
   * Unique across every pack, so namespace it — `'mtb.assets'`, not
   * `'assets'`. Registering an id twice throws rather than silently replacing
   * the other pack's tab.
   */
  readonly id: string
  readonly title: string
  /**
   * An iconify class, e.g. `'icon-[lucide--activity]'`. Omit for no icon.
   */
  readonly icon?: string
  readonly tooltip?: string
}

/**
 * A tab the pack draws into a container itself.
 *
 * Framework-agnostic, and the only form available to a pack that ships
 * hand-written ES modules with no build step — which is most of them.
 */
/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface MountedSidebarTab extends SidebarTabBase {
  /**
   * Fills the tab's panel. Called each time the tab becomes visible, so treat
   * it as mount rather than as one-time setup, and put teardown in `destroy`.
   */
  render(container: HTMLElement): void
  /** Releases what `render` retained — listeners, timers, observers. */
  destroy?(): void
}

/**
 * A tab that is a Vue component, mounted and torn down by the host.
 *
 * The preferred form where a pack can build. It keeps reactivity, scoped
 * styles and `onUnmounted`, and the host mounts and unmounts it.
 *
 * Per ADR 0005 the pack bundles its own Vue (~30KB gzipped) — there is no
 * import map, so `import { defineComponent } from 'vue'` resolves at the
 * pack's build time, not ours. That is a second Vue instance on the page,
 * which the ADR weighed and accepted; nothing is shared across the boundary,
 * so the two runtimes never touch.
 */
/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface VueSidebarTab extends SidebarTabBase {
  readonly component: VueComponent
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export type SidebarTabDef = MountedSidebarTab | VueSidebarTab

/** A Vue component bundled by the pack. */
/** @knipIgnoreUnusedButUsedByCustomNodes */
export type VueComponent = object

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface DialogBase {
  /**
   * Unique across every pack, so namespace it. The host prefixes it with
   * `extension-`, which keeps packs out of the internal dialog keyspace.
   */
  readonly key: string
  readonly title?: string
}

/** A dialog the pack draws into a container itself. */
/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface MountedDialog extends DialogBase {
  render(container: HTMLElement): void
  destroy?(): void
}

/** A dialog that is a Vue component, mounted and torn down by the host. */
/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface VueDialog extends DialogBase {
  readonly component: VueComponent
  readonly props?: Readonly<Record<string, unknown>>
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export type DialogDef = MountedDialog | VueDialog

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface DialogHandle {
  close(): void
}

/**
 * Wraps a pack's `render`/`destroy` pair in a component, because the host's
 * dialog stack takes a component and nothing else.
 *
 * Deliberately the same contract as `widgets.mount` and the sidebar's mounted
 * arm: the host owns the lifecycle, `render` may run more than once, and
 * teardown belongs in `destroy`.
 */
function mountedDialogComponent(def: MountedDialog): Component {
  return markRaw(
    defineComponent({
      name: `PackDialog_${def.key.replace(/\W/g, '_')}`,
      setup() {
        const host = ref<HTMLElement>()
        onMounted(() => {
          if (host.value) def.render(host.value)
        })
        onUnmounted(() => def.destroy?.())
        return () => h('div', { ref: host })
      }
    })
  )
}

function hostComponent(component: VueComponent): Component {
  return component as Component
}

export interface UiHandle {
  /**
   * Adds a tab to the sidebar. Returns a function that removes it again.
   */
  addSidebarTab(def: SidebarTabDef): Unsubscribe
  /**
   * Shows a small readout in the top bar — a status, a count, a live metric.
   *
   * Replaces `app.menu.settingsGroup` and inserting an element next to
   * `.comfy-settings-btn`. Declarative on purpose: the pack says what to show
   * and the host renders it, in house style and at whatever size the viewport
   * allows. Nothing here takes an element, a class or a style, which is what
   * keeps the chrome ours to restyle.
   *
   * Returns a handle rather than an unsubscribe: for a value that changes,
   * call `update({ text })`. A closure would not work — the host renders when
   * reactive state changes and cannot see a plain function, so the readout
   * would show its first value forever.
   */
  addTopBarBadge(badge: BadgeContribution): ChromeItemHandle<BadgeContribution>
  /**
   * Adds a button to the action bar. `run` is called on click.
   *
   * For a pack that also wants a keyboard shortcut or a palette entry,
   * register a command and call it from `run`, rather than duplicating the
   * behaviour in both places.
   */
  addActionBarButton(
    button: ButtonContribution
  ): ChromeItemHandle<ButtonContribution>
  /**
   * Opens a modal dialog. Returns a handle that closes it again.
   *
   * Replaces `app.ui.dialog` and the `new app.ui.dialog.constructor()` idiom.
   * Several conversions hand-rolled a native `<dialog>` or borrowed core's
   * `.comfy-modal` class names instead — the latter couples a pack to markup
   * we rename freely, so both are worth retiring.
   */
  showDialog(def: DialogDef): DialogHandle
  /**
   * Shows a menu where the user clicked.
   *
   * `b.addMenuItem` is the node's own context menu — a different menu, on a
   * different target, opened by the host. This is for a menu a pack raises
   * itself: a lora row's Move Up / Remove, a chip that picks an output type.
   * Four files hand-rolled it by constructing the renderer's menu class
   * directly, which pins them to a renderer we intend to replace.
   *
   * Positioned from the event so the menu lands under the pointer, which is the
   * only placement that reads as a context menu. Arrow keys traverse nested
   * items, Enter or Tab selects one, and Escape closes the menu.
   */
  showMenu(def: MenuDef): MenuHandle
  /**
   * Asks the user for a value. Resolves `undefined` if they cancel.
   *
   * Packs called `canvas.prompt(...)`, which draws a small field at the cursor
   * — clicking a lora's strength to type a new one. That field belongs to the
   * legacy canvas and the host itself no longer uses it; this is the prompt the
   * host does use, so a pack keeps the capability and loses only the placement.
   */
  prompt(def: PromptDef): Promise<string | undefined>
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface PromptDef {
  /** What is being asked for — "Strength", "Label". */
  readonly label: string
  readonly value?: string
  readonly placeholder?: string
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface MenuItemDef {
  readonly label: string
  /** Shown but not selectable. */
  readonly disabled?: boolean
  /** A nested menu. Mutually exclusive with {@link run}. */
  readonly submenu?: readonly MenuItemDef[]
  run?(): void
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface MenuDef {
  readonly items: readonly MenuItemDef[]
  /** Shown above the items. */
  readonly title?: string
  /** The event that asked for the menu; it decides where the menu appears. */
  readonly event: MouseEvent
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface MenuHandle {
  close(): void
}

/**
 * A nested menu is `submenu.options`, and an item with one must not also carry
 * a callback: the renderer fires both, so a submenu parent that ran something
 * would fire it on the way past.
 */
function toMenuValue(item: MenuItemDef): IContextMenuValue {
  return {
    content: item.label,
    disabled: item.disabled,
    ...(item.submenu
      ? {
          has_submenu: true,
          submenu: { options: item.submenu.map(toMenuValue) }
        }
      : { callback: () => item.run?.() })
  }
}

const selectedMenuEntry = new WeakMap<ContextMenu, HTMLElement>()

function menuEntries(menu: ContextMenu): HTMLElement[] {
  return Array.from(menu.root.children).filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement &&
      element.getAttribute('role') === 'menuitem' &&
      element.getAttribute('aria-disabled') !== 'true'
  )
}

function deepestMenu(menu: ContextMenu): ContextMenu {
  return menu.current_submenu ? deepestMenu(menu.current_submenu) : menu
}

function focusMenuEntry(menu: ContextMenu, index: number): void {
  const entries = menuEntries(menu)
  const entry = entries[index]
  if (!entry) return
  entry.tabIndex = -1
  entry.focus()
  selectedMenuEntry.set(menu, entry)
}

function selectedIndex(menu: ContextMenu): number {
  const selected = selectedMenuEntry.get(menu)
  return selected ? menuEntries(menu).indexOf(selected) : -1
}

function enableMenuKeyboard(root: ContextMenu): void {
  document.addEventListener(
    'keydown',
    (event) => {
      const menu = deepestMenu(root)
      const entries = menuEntries(menu)
      const index = selectedIndex(menu)

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const offset = event.key === 'ArrowDown' ? 1 : -1
        const next =
          index < 0
            ? 0
            : Math.max(0, Math.min(index + offset, entries.length - 1))
        focusMenuEntry(menu, next)
        return
      }
      if (event.key === 'ArrowRight' && index >= 0) {
        event.preventDefault()
        if (entries[index].getAttribute('aria-haspopup') !== 'true') return
        entries[index].click()
        const submenu = deepestMenu(root)
        if (submenu !== menu) focusMenuEntry(submenu, 0)
        return
      }
      if (event.key === 'ArrowLeft' && menu.parentMenu) {
        event.preventDefault()
        const parent = menu.parentMenu
        menu.close(new MouseEvent('pointermove'))
        focusMenuEntry(parent, selectedIndex(parent))
        return
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && index >= 0) {
        event.preventDefault()
        entries[index].click()
        const submenu = deepestMenu(root)
        if (submenu !== menu) focusMenuEntry(submenu, 0)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        root.close()
      }
    },
    { signal: root.controller.signal }
  )
}

export function createUiHandle(): UiHandle {
  return {
    addTopBarBadge: addBadgeContribution,
    addActionBarButton: addButtonContribution,

    addSidebarTab(def) {
      if (!def.id.trim()) {
        throw new ComfyApiError('A sidebar tab needs an id.')
      }
      const store = useSidebarTabStore()
      if (store.sidebarTabs.some((tab) => tab.id === def.id)) {
        throw new ComfyApiError(
          `A sidebar tab with id '${def.id}' is already registered. ` +
            `Namespace the id to your pack so two packs cannot collide.`
        )
      }

      const common = {
        id: def.id,
        title: def.title,
        ...(def.icon === undefined ? {} : { icon: def.icon }),
        ...(def.tooltip === undefined ? {} : { tooltip: def.tooltip })
      }

      store.registerSidebarTab(
        'component' in def
          ? // The store's state is reactive, so a component definition put in
            // it unmarked is wrapped in a Proxy — which Vue warns about and
            // which costs a deep traversal of the whole definition for no
            // benefit. A component is data to be rendered, never observed.
            {
              ...common,
              type: 'vue',
              component: markRaw(hostComponent(def.component))
            }
          : {
              ...common,
              type: 'custom',
              render: def.render,
              ...(def.destroy === undefined ? {} : { destroy: def.destroy })
            }
      )

      return () => useSidebarTabStore().unregisterSidebarTab(def.id)
    },

    async prompt(def) {
      if (!def.label.trim()) {
        throw new ComfyApiError('A prompt needs a label.')
      }
      const { useDialogService } = await import('@/services/dialogService')
      const answer = await useDialogService().prompt({
        title: def.label,
        message: def.label,
        defaultValue: def.value ?? '',
        placeholder: def.placeholder
      })
      // `null` is the host's "cancelled"; packs read `undefined` everywhere
      // else in this API, and two spellings of absent is a bug waiting.
      return answer ?? undefined
    },

    showMenu(def) {
      if (!def.items.length) {
        throw new ComfyApiError('A menu needs at least one item.')
      }
      // Built against the renderer's own menu because the host still raises
      // its menus that way — see useLoad3d and exportMenuHelper. Packs get the
      // intent, so replacing it underneath costs them nothing.
      const menu = new ContextMenu(def.items.map(toMenuValue), {
        title: def.title,
        event: def.event
      })
      enableMenuKeyboard(menu)
      return Object.freeze({ close: () => menu.close() })
    },

    showDialog(def) {
      if (!def.key.trim()) {
        throw new ComfyApiError('A dialog needs a key.')
      }
      const store = useDialogStore()
      const component =
        'component' in def
          ? markRaw(hostComponent(def.component))
          : mountedDialogComponent(def)

      store.showExtensionDialog({
        key: def.key,
        component,
        ...(def.title === undefined ? {} : { title: def.title }),
        ...('component' in def && def.props ? { props: def.props } : {})
      })

      // The host prefixes the key; closing has to use the same one it stored.
      const stored = def.key.startsWith('extension-')
        ? def.key
        : `extension-${def.key}`
      return { close: () => useDialogStore().closeDialog({ key: stored }) }
    }
  }
}
