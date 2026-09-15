/**
 * What a pack may put in the application's own chrome.
 *
 * Packs placed a live resource readout and a locale toggle in the menu bar by
 * reaching for `app.menu.settingsGroup` and the `ComfyButton`/`ComfyButtonGroup`
 * classes, or — failing that — by `querySelector('.comfy-settings-btn')` and
 * inserting a bare `<div>` next to it. That is a pack laying out the host's
 * chrome, and it breaks the moment the chrome is restyled or replaced.
 *
 * So the contribution is declarative: a pack states what it wants shown and the
 * host renders it, in house style, at whatever size the viewport allows. Nothing
 * here accepts an element, a class name or a style. That is the control — it
 * keeps the chrome ours to restyle, which Nodes 2.0 needs, and it means a pack
 * cannot break the layout for everyone else.
 *
 * Registering returns a handle rather than an unsubscribe, because the
 * motivating case is a value that changes every second. A closure over a
 * mutable variable would not work: the host renders when reactive state
 * changes, and a plain function is invisible to that, so the readout would show
 * its first value forever. `update()` writes, which the host can see.
 */
import { computed, ref } from 'vue'

import type { ActionBarButton, TopbarBadge } from '@/types/comfy'

import { ComfyApiError } from './errors'

export interface BadgeContribution {
  /** Namespaced, e.g. `Crystools.monitor`. Registering the same id twice throws. */
  readonly id: string
  readonly text: string
  readonly label?: string
  readonly variant?: 'info' | 'warning' | 'error'
  /** An iconify or PrimeIcons class, e.g. `pi-chart-bar`. */
  readonly icon?: string
  readonly tooltip?: string
}

/** What a pack keeps after contributing something to the chrome. */
export interface ChromeItemHandle<T> {
  /** Changes what is shown. Only the fields given are replaced. */
  update(changes: Partial<Omit<T, 'id'>>): void
  remove(): void
}

export interface ButtonContribution {
  readonly id: string
  readonly icon: string
  readonly label?: string
  readonly tooltip?: string
  /**
   * The click. The event is passed because packs branch on modifiers — one
   * opens its panel in a sized window on shift-click — and without it that
   * behaviour has nothing to read. It is absent when something invokes the
   * button directly rather than by click.
   */
  run(event?: MouseEvent): void
}

const badges = new Map<string, BadgeContribution>()
const buttons = new Map<string, ButtonContribution>()
/** Plain Maps are not reactive; this is what the computeds depend on. */
const bump = ref(0)

function claim<T extends { id: string }>(
  registry: Map<string, T>,
  contribution: T,
  kind: string
): ChromeItemHandle<T> {
  if (!contribution.id.includes('.')) {
    throw new ComfyApiError(
      `${kind} id '${contribution.id}' must be namespaced, e.g. 'MyPack.${contribution.id}'.`
    )
  }
  if (registry.has(contribution.id)) {
    // Silently replacing would let a pack loaded twice, or two packs that
    // picked the same id, fight over one slot with no way to see it.
    throw new ComfyApiError(
      `${kind} id '${contribution.id}' is already registered.`
    )
  }
  registry.set(contribution.id, contribution)
  let live = true
  return Object.freeze({
    update(changes: Partial<Omit<T, 'id'>>) {
      const current = live ? registry.get(contribution.id) : undefined
      // Silently reviving a removed item would leave a pack showing something
      // it thinks it took down.
      if (!current) {
        throw new ComfyApiError(
          `${kind} '${contribution.id}' has been removed and cannot be updated.`
        )
      }
      registry.set(contribution.id, {
        ...current,
        ...changes,
        id: contribution.id
      })
      bump.value++
    },
    remove() {
      if (!live) return
      live = false
      registry.delete(contribution.id)
      bump.value++
    }
  })
}

export function addBadgeContribution(
  contribution: BadgeContribution
): ChromeItemHandle<BadgeContribution> {
  const handle = claim(badges, contribution, 'Badge')
  bump.value++
  return handle
}

export function addButtonContribution(
  contribution: ButtonContribution
): ChromeItemHandle<ButtonContribution> {
  const handle = claim(buttons, contribution, 'Button')
  bump.value++
  return handle
}

/** Read by the store that renders the top bar. */
export const contributedBadges = computed<TopbarBadge[]>(() => {
  void bump.value
  return [...badges.values()].map(
    ({ text, label, variant, icon, tooltip }) => ({
      text,
      label,
      variant,
      icon,
      tooltip
    })
  )
})

/** Read by the store that renders the action bar. */
export const contributedButtons = computed<ActionBarButton[]>(() => {
  void bump.value
  return [...buttons.values()].map(({ icon, label, tooltip, run }) => ({
    icon,
    label,
    tooltip,
    onClick: (event?: MouseEvent) => run(event)
  }))
})

/** Test seam. */
export function resetChromeContributions(): void {
  badges.clear()
  buttons.clear()
  bump.value++
}
