/**
 * Replace media elements with fresh copies created in the live document.
 *
 * Astro's ClientRouter parses incoming pages with DOMParser, whose inert
 * document never initialises the browser's media stack, so after a soft
 * navigation every swapped-in <video>/<audio> reports "no supported
 * sources" and cannot play. Mirrors the upstream fix
 * (https://github.com/withastro/astro/issues/17601), which is not yet in
 * a released Astro version — remove this once we're on a release that
 * includes it.
 */
export function reifyMediaElements(root: ParentNode) {
  for (const media of root.querySelectorAll<HTMLMediaElement>('video, audio')) {
    const fresh = document.createElement(media.localName) as HTMLMediaElement
    for (const attr of media.attributes) {
      fresh.setAttribute(attr.name, attr.value)
    }
    // Copying the muted attribute only sets defaultMuted on an existing
    // element, and unmuted autoplay is blocked without user engagement.
    fresh.muted = media.muted
    fresh.innerHTML = media.innerHTML
    media.replaceWith(fresh)
  }
}
