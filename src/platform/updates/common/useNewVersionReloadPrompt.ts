import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { onScopeDispose, watch } from 'vue'
import type { Router } from 'vue-router'

import { useExecutionStore } from '@/stores/executionStore'

import { useDesiredVersionStore } from './desiredVersionStore'

export const NEW_VERSION_TOAST_GROUP = 'new-version-available'

interface UseNewVersionReloadPromptOptions {
  /**
   * Called when drift is detected and the tab is idle, to surface the
   * non-blocking prompt. Wiring supplies a toast opener; tests supply a spy.
   */
  showPrompt: () => void
  /**
   * Called to tear down the prompt (e.g. when it should no longer be shown).
   * Optional — wiring may leave the toast to the user's dismiss action.
   */
  hidePrompt?: () => void
  /** Reload the page. Injectable so tests don't touch `window.location`. */
  reload?: () => void
  /**
   * When provided, a one-shot navigation guard reloads onto the fresh version
   * on the next in-app navigation, evicting the tab even if the prompt was
   * dismissed. This is the "reload on next nav" half of the acceptance criteria.
   */
  router?: Router
}

/**
 * Soft "new version available" reload prompt.
 *
 * Polls the desired-version signal cheaply — on window focus, never on a tight
 * timer — and, when the running bundle has drifted from the version the edge now
 * serves, surfaces a non-blocking, dismissible prompt offering a reload. The
 * prompt is suppressed while a generation is running so we never interrupt
 * active work; it re-evaluates once the tab returns to idle.
 *
 * Accepting reloads immediately. If a router is supplied, the next in-app
 * navigation also reloads onto the fresh version, so a dismissed prompt still
 * eventually evicts a retired tab.
 */
export function useNewVersionReloadPrompt(
  options: UseNewVersionReloadPromptOptions
) {
  const {
    showPrompt,
    hidePrompt,
    reload = () => window.location.reload(),
    router
  } = options

  const desiredVersionStore = useDesiredVersionStore()
  const { hasNewVersion } = storeToRefs(desiredVersionStore)
  const executionStore = useExecutionStore()

  let hasShownPrompt = false
  let removeNavGuard: (() => void) | undefined

  const canPrompt = () => hasNewVersion.value && executionStore.isIdle

  const maybeShowPrompt = () => {
    if (hasShownPrompt) return
    if (!canPrompt()) return
    hasShownPrompt = true
    showPrompt()
    // Once we know this tab is stale, evict it on the next navigation even if
    // the user dismisses the toast without reloading.
    if (router && !removeNavGuard) {
      removeNavGuard = router.beforeEach(() => {
        reload()
        // Block the SPA transition; the full reload lands on the fresh version.
        return false
      })
    }
  }

  const accept = () => {
    hidePrompt?.()
    reload()
  }

  const dismiss = () => {
    hidePrompt?.()
  }

  // Cheap polling: re-probe the edge whenever the tab regains focus, then
  // re-evaluate whether to prompt. No setInterval / tight loop.
  useEventListener(window, 'focus', () => {
    void desiredVersionStore.refresh().then(maybeShowPrompt)
  })

  // React to drift becoming known via any refresh.
  watch(hasNewVersion, (drifted) => {
    if (drifted) maybeShowPrompt()
  })

  // Re-probe the edge once a generation finishes, so a version that was promoted
  // while the tab was busy is detected promptly instead of waiting for the next
  // window-focus event. (While busy we never interrupt; this fires on the
  // idle transition.)
  watch(
    () => executionStore.isIdle,
    (isIdle) => {
      if (isIdle) void desiredVersionStore.refresh().then(maybeShowPrompt)
    }
  )

  // Don't leak the navigation guard if this consumer is torn down before a
  // navigation happens.
  onScopeDispose(() => {
    removeNavGuard?.()
    removeNavGuard = undefined
  })

  return {
    accept,
    dismiss,
    /** Perform an initial probe + evaluation (e.g. on mount). */
    checkNow: () => desiredVersionStore.refresh().then(maybeShowPrompt),
    /** For tests: has the prompt been surfaced this session. */
    get hasShownPrompt() {
      return hasShownPrompt
    }
  }
}
