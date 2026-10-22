type TransitionBeforeSwapEvent = DocumentEventMap['astro:before-swap']

const markerAttribute = 'data-ccc-preserved-media'
interface OriginalMedia {
  element: Element
  marker: string
  previous: string | null
}
function restoreMarker(element: Element, previous: string | null) {
  if (previous === null) element.removeAttribute(markerAttribute)
  else element.setAttribute(markerAttribute, previous)
}
function replaceMedia(
  island: HTMLElement,
  tagged: Map<string, OriginalMedia>,
  clones: Element[]
) {
  if (!island.isConnected) return
  for (const element of island.querySelectorAll('video, audio')) {
    const marker = element.getAttribute(markerAttribute)
    const original = marker ? tagged.get(marker) : undefined
    if (!original || element === original.element) continue
    clones.push(element)
    element.replaceWith(original.element)
  }
}
function restoreMarkers(
  elements: Element[],
  tagged: Map<string, OriginalMedia>
) {
  for (const element of elements) {
    const marker = element.getAttribute(markerAttribute)
    const original = marker ? tagged.get(marker) : undefined
    if (original) restoreMarker(element, original.previous)
  }
}

export function preserveCatalogueMedia(
  event: TransitionBeforeSwapEvent,
  island: HTMLElement
) {
  const persistId = island.getAttribute('data-astro-transition-persist')
  const component = island.getAttribute('component-url')
  if (
    island.localName !== 'astro-island' ||
    !island.isConnected ||
    !persistId?.startsWith('ccc-hub-catalogue-') ||
    !component
  )
    return
  const incoming = Array.from(
    event.newDocument.querySelectorAll('astro-island')
  ).find(
    (element) =>
      element.getAttribute('data-astro-transition-persist') === persistId
  )
  if (
    !incoming ||
    incoming.getAttribute('component-url') !== component ||
    incoming.getAttribute('component-export') !==
      island.getAttribute('component-export')
  )
    return

  const swap = event.swap
  event.swap = () => {
    const originals = Array.from(island.querySelectorAll('video, audio')).map(
      (element) => ({
        element,
        marker: crypto.randomUUID(),
        previous: element.getAttribute(markerAttribute)
      })
    )
    const tagged = new Map<string, (typeof originals)[number]>(
      originals.map((entry) => [entry.marker, entry])
    )
    const clones: Element[] = []
    for (const { element, marker } of originals)
      element.setAttribute(markerAttribute, marker)
    try {
      swap()
      replaceMedia(island, tagged, clones)
    } finally {
      restoreMarkers(
        [...island.querySelectorAll('video, audio'), ...clones],
        tagged
      )
      for (const { element, previous } of originals)
        restoreMarker(element, previous)
    }
  }
}
