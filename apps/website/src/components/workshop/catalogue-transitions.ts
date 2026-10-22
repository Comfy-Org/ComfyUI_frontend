type CatalogueSwapEvent = DocumentEventMap['astro:before-swap']

export function skipCatalogueTransition(
  event: CatalogueSwapEvent,
  island: HTMLElement
) {
  const persist = island.getAttribute('data-astro-transition-persist')
  const component = island.getAttribute('component-url')
  if (
    !island.isConnected ||
    island.localName !== 'astro-island' ||
    !persist?.startsWith('ccc-hub-catalogue-') ||
    !component
  )
    return
  const incoming = [...event.newDocument.querySelectorAll('astro-island')].find(
    (candidate) =>
      candidate.getAttribute('data-astro-transition-persist') === persist
  )
  if (
    !incoming ||
    incoming.getAttribute('component-url') !== component ||
    incoming.getAttribute('component-export') !==
      island.getAttribute('component-export')
  )
    return
  void event.viewTransition.ready.catch(() => undefined)
  event.viewTransition.skipTransition()
}
