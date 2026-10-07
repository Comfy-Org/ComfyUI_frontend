import { captureVfxLinkClick } from '@/scripts/posthog'
import { campaignHref } from '@/utils/campaignHref'

function linkPlacement(link: HTMLAnchorElement) {
  if (link.closest('#workflows')) return 'workflows'
  if (link.closest('#studio')) return 'studio'
  if (link.closest('[data-vfx-hero]')) return 'hero'
  return 'page'
}

export function mountVfxCampaign(root: HTMLElement): () => void {
  function onPlay(event: Event) {
    if (!(event.target instanceof HTMLVideoElement)) return
    for (const video of root.querySelectorAll('video')) {
      if (video !== event.target && !video.paused) video.pause()
    }
  }

  function decorateLinks() {
    for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const href = link.getAttribute('href')
      if (!href) continue
      const decorated = campaignHref(href, window.location.href)
      if (decorated !== href) link.setAttribute('href', decorated)
    }
  }

  function onClick(event: MouseEvent) {
    if (!(event.target instanceof Element)) return
    const anchor = event.target.closest('a')
    if (!anchor && event.target.closest('button, input, [role="slider"]'))
      return
    const card = event.target.closest('[data-testid="hub-card"]')
    const link = anchor ?? card?.querySelector('a[data-testid="hub-card-link"]')
    if (!(link instanceof HTMLAnchorElement)) return

    captureVfxLinkClick({
      destination: new URL(link.href).pathname,
      placement: linkPlacement(link)
    })
    if (!anchor && card) {
      event.stopPropagation()
      window.open(link.href, '_blank', 'noopener')
    }
  }

  decorateLinks()
  const observer = new MutationObserver(decorateLinks)
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href']
  })
  root.addEventListener('click', onClick, true)
  root.addEventListener('play', onPlay, true)
  return () => {
    observer.disconnect()
    root.removeEventListener('click', onClick, true)
    root.removeEventListener('play', onPlay, true)
  }
}
