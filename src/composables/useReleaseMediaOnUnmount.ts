import { onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'

/**
 * Force-release a media element's decode buffers before it unmounts.
 *
 * iOS Safari keeps a detached `<video>`/`<audio>`'s media pipeline and decoded
 * frames alive when Vue merely removes the element from the DOM. Without an
 * explicit pause + source clear + `load()`, repeatedly opening media previews
 * (e.g. a long clip in the full-screen lightbox) accumulates decoded memory
 * until WebKit kills the renderer process — the "A problem repeatedly occurred"
 * crash. See FE-1105.
 *
 * Handles both the `src`-attribute and nested `<source>`-element forms.
 */
export function useReleaseMediaOnUnmount(
  elementRef: Readonly<Ref<HTMLMediaElement | null>>
) {
  onBeforeUnmount(() => {
    const el = elementRef.value
    if (!el) return
    el.pause()
    el.removeAttribute('src')
    while (el.firstChild) el.removeChild(el.firstChild)
    el.load()
  })
}
