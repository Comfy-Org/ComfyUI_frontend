export function installNativeCatalogueTabNavigation() {
  const catalogueSelector =
    'astro-island[data-astro-transition-persist^="ccc-hub-catalogue-"], [data-ccc-abandoned-catalogue]'
  function reset(event?: PageTransitionEvent) {
    if (
      event?.persisted &&
      document.querySelector('[data-ccc-abandoned-catalogue]')
    ) {
      location.reload()
      return
    }
    for (const nav of document.querySelectorAll<HTMLElement>(
      '[data-testid="catalogue-tabs"][aria-busy="true"]'
    )) {
      if (!nav.closest(catalogueSelector)) continue
      const links = [...nav.querySelectorAll<HTMLAnchorElement>('a')]
      const index = links.findIndex(
        (link) => link.getAttribute('aria-current') === 'page'
      )
      const marker = nav.querySelector<HTMLElement>(
        '[data-testid="catalogue-marker"]'
      )
      if (marker && index >= 0)
        marker.style.transform = `translateX(${index * 100}%)`
      nav.removeAttribute('aria-busy')
    }
  }
  function click(event: MouseEvent) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    const link =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>('a[data-astro-reload]')
        : null
    if (
      !link ||
      (link.target && link.target !== '_self') ||
      link.hasAttribute('download')
    )
      return
    const nav = link.closest<HTMLElement>('[data-testid="catalogue-tabs"]')
    const catalogue = nav?.closest<HTMLElement>(catalogueSelector)
    if (!nav || !catalogue) return
    if (catalogue.tagName === 'ASTRO-ISLAND' && !catalogue.hasAttribute('ssr'))
      return
    const target = new URL(link.href, location.href)
    if (target.origin !== location.origin) return
    const links = [...nav.querySelectorAll<HTMLAnchorElement>('a')]
    const index = links.indexOf(link)
    const marker = nav.querySelector<HTMLElement>(
      '[data-testid="catalogue-marker"]'
    )
    if (index < 0 || !marker) return
    event.preventDefault()
    marker.style.transform = `translateX(${index * 100}%)`
    nav.setAttribute('aria-busy', 'true')
    if (catalogue.tagName === 'ASTRO-ISLAND') {
      const placeholder = document.createElement('div')
      placeholder.setAttribute('data-ccc-abandoned-catalogue', '')
      placeholder.style.display = 'contents'
      const snapshot = catalogue.cloneNode(true)
      placeholder.append(...snapshot.childNodes)
      for (const child of placeholder.querySelectorAll('astro-island')) {
        const staticContent = document.createElement('div')
        staticContent.style.display = 'contents'
        staticContent.append(...child.childNodes)
        child.replaceWith(staticContent)
      }
      catalogue.replaceWith(placeholder)
    }
    window.stop()
    location.assign(target.href)
  }
  document.addEventListener('click', click)
  window.addEventListener('pageshow', reset)
  return () => {
    document.removeEventListener('click', click)
    window.removeEventListener('pageshow', reset)
    reset()
  }
}
