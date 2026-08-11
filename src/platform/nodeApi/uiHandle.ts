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
import { markRaw } from 'vue'
import type { Component } from 'vue'

import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

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
  readonly component: Component
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export type SidebarTabDef = MountedSidebarTab | VueSidebarTab

export interface UiHandle {
  /**
   * Adds a tab to the sidebar. Returns a function that removes it again.
   */
  addSidebarTab(def: SidebarTabDef): Unsubscribe
}

export function createUiHandle(): UiHandle {
  return {
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
            { ...common, type: 'vue', component: markRaw(def.component) }
          : {
              ...common,
              type: 'custom',
              render: def.render,
              ...(def.destroy === undefined ? {} : { destroy: def.destroy })
            }
      )

      return () => useSidebarTabStore().unregisterSidebarTab(def.id)
    }
  }
}
