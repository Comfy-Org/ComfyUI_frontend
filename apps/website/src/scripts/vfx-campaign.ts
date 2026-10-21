import { captureVfxLinkClick } from '@/scripts/posthog'
import { isVfxV3Path, vfxNavCloudHref } from '@/utils/vfxNavCampaign'
import { campaignHref } from '@/utils/campaignHref'

function linkPlacement(
  link: HTMLAnchorElement
): Parameters<typeof captureVfxLinkClick>[0]['placement'] {
  if (link.closest('#workflows')) return 'workflows'
  if (link.closest('#studio')) return 'studio'
  if (link.closest('[data-vfx-hero], [data-campaign-hero]')) return 'hero'
  return 'page'
}

function isCanvasMedia(video: HTMLVideoElement) {
  return video.closest('[data-playback-background]') !== null
}

function playbackTarget(event: Event) {
  if (!(event.target instanceof HTMLVideoElement)) return undefined
  return isCanvasMedia(event.target) ? undefined : event.target
}

function playbackGroup(video: HTMLVideoElement) {
  return video.closest('[data-playback-group]')
}

function belongsToPlaybackGroup(
  video: HTMLVideoElement,
  comparison: Element | null
) {
  if (!comparison) return false
  if (comparison.contains(video)) return true
  return isCanvasMedia(video)
}

function shouldPauseVideo(
  video: HTMLVideoElement,
  active: HTMLVideoElement,
  comparison: Element | null
) {
  return (
    video !== active &&
    !video.paused &&
    !belongsToPlaybackGroup(video, comparison)
  )
}

export function mountVfxCampaign(root: HTMLElement): () => void {
  function onPlay(event: Event) {
    const active = playbackTarget(event)
    if (!active) return
    const comparison = playbackGroup(active)
    for (const video of root.querySelectorAll('video')) {
      if (shouldPauseVideo(video, active, comparison)) video.pause()
    }
  }

  function decorateLinks() {
    for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const href = link.getAttribute('href')
      if (!href) continue
      const decorated =
        isVfxV3Path(window.location.pathname) &&
        link.matches('nav [data-vfx-nav-no-utm]')
          ? vfxNavCloudHref(window.location.pathname, href)
          : campaignHref(href, window.location.href)
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

    const properties = {
      destination: new URL(link.href).pathname,
      placement: linkPlacement(link)
    }
    captureVfxLinkClick(properties)
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
