import { onMounted, ref } from 'vue'

import { BANNER_DISMISS_ATTR, BANNER_STORAGE_KEY } from '../utils/banner'

type ClosedBanners = Record<string, boolean>

function readClosedBanners(): ClosedBanners {
  try {
    const raw = localStorage.getItem(BANNER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ClosedBanners) : {}
  } catch {
    return {}
  }
}

function writeClosedBanners(value: ClosedBanners): void {
  try {
    localStorage.setItem(BANNER_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode / quota) — dismissal just won't persist.
  }
}

/** The stable part of a version key (everything before `_v<hash>`). */
function versionPrefix(version: string): string {
  const idx = version.lastIndexOf('_v')
  return idx === -1 ? version : version.slice(0, idx)
}

/**
 * Client-side dismissal persisted in localStorage, keyed by a content-aware
 * `version`. The banner renders visible in the static HTML (so non-dismissers
 * see no pop-in); an inline pre-hydration script hides an already-dismissed
 * banner before paint, and this composable then removes it from the DOM on mount.
 */
export function useBannerDismissal(version: string) {
  const isVisible = ref(true)

  onMounted(() => {
    const stored = readClosedBanners()
    const prefix = versionPrefix(version)

    // Prune stale versions of THIS banner+locale; keep other banners/locales
    // and the current version.
    const cleaned: ClosedBanners = Object.create(null) as ClosedBanners
    let pruned = false
    for (const key of Object.keys(stored)) {
      if (versionPrefix(key) !== prefix || key === version) {
        cleaned[key] = stored[key]
      } else {
        pruned = true
      }
    }
    if (pruned) writeClosedBanners(cleaned)

    isVisible.value = !cleaned[version]
  })

  function close(): void {
    isVisible.value = false
    const stored = readClosedBanners()
    stored[version] = true
    writeClosedBanners(stored)
  }

  // Call once the close transition has finished. Sets the pre-paint hide signal
  // so the banner doesn't flash back in on a ClientRouter (view-transition)
  // navigation — where the inline <head> script does not re-run but <html>
  // persists. Deferred to after the animation so the leave transition can play.
  function persistHidden(): void {
    document.documentElement.setAttribute(BANNER_DISMISS_ATTR, '')
  }

  return { isVisible, close, persistHidden }
}
