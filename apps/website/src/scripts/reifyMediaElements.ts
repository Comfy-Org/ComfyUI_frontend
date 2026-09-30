/**
 * Replace media elements with fresh copies created in the live document.
 *
 * Astro's ClientRouter parses incoming pages with DOMParser, whose inert
 * document never initialises the browser's media stack, so after a soft
 * navigation every swapped-in <video>/<audio> reports "no supported
 * sources" and cannot play. Swapped-in iframes can also remain blank.
 * Astro handles video/audio upstream (https://github.com/withastro/astro/issues/17601),
 * but the iframe workaround is still needed.
 */
export function reifyMediaElements(root: ParentNode) {
  for (const media of root.querySelectorAll('video, audio, iframe')) {
    const fresh = document.createElement(media.localName)
    for (const attr of media.attributes) {
      fresh.setAttribute(attr.name, attr.value)
    }
    // Copying the muted attribute only sets defaultMuted on an existing
    // element, and unmuted autoplay is blocked without user engagement.
    if (
      media instanceof HTMLMediaElement &&
      fresh instanceof HTMLMediaElement
    ) {
      fresh.muted = media.muted
    }
    fresh.innerHTML = media.innerHTML
    media.replaceWith(fresh)
  }
}
