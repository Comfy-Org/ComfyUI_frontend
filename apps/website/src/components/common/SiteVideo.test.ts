import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import SiteVideo from './SiteVideo.vue'

type SiteVideoProps = ComponentProps<typeof SiteVideo>

async function renderSiteVideo(
  props: Partial<SiteVideoProps> = {}
): Promise<string> {
  const app = createSSRApp({
    render: () =>
      h(SiteVideo, {
        name: 'hero',
        baseUrl: 'https://media.example.com/careers',
        ...props
      })
  })
  return renderToString(app)
}

describe('SiteVideo', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('renders <video> with the caller-supplied muted attribute', async () => {
    const html = await renderSiteVideo({ autoplay: true, muted: true })
    expect(html).toMatch(/<video[^>]*\smuted\b/)
    expect(html).toMatch(/<video[^>]*\sautoplay\b/)
  })

  it('does NOT render muted when the caller omits it', async () => {
    // Regression guard for Vue's Boolean-cast rule: an absent Boolean prop
    // resolves to `false`, so the component cannot silently fall back to
    // `autoplay`. Callers must pass `muted` explicitly.
    const html = await renderSiteVideo({ autoplay: true })
    expect(html).not.toMatch(/<video[^>]*\smuted\b/)
  })

  it('warns in dev when autoplay is set without muted', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await renderSiteVideo({ autoplay: true })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('autoplay without muted')
    )
  })

  it('does not warn when both autoplay and muted are set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await renderSiteVideo({ autoplay: true, muted: true })
    expect(warn).not.toHaveBeenCalled()
  })

  it('stays silent in production even when autoplay is set without muted', async () => {
    vi.stubEnv('DEV', false)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await renderSiteVideo({ autoplay: true })
    expect(warn).not.toHaveBeenCalled()
  })

  it('defaults preload to "auto" when autoplay is true', async () => {
    const html = await renderSiteVideo({ autoplay: true, muted: true })
    expect(html).toMatch(/preload="auto"/)
  })

  it('defaults preload to "metadata" when autoplay is false', async () => {
    const html = await renderSiteVideo()
    expect(html).toMatch(/preload="metadata"/)
  })

  it('honors an explicit preload override', async () => {
    const html = await renderSiteVideo({
      autoplay: true,
      muted: true,
      preload: 'none'
    })
    expect(html).toMatch(/preload="none"/)
  })

  it('emits webm and mp4 sources by default in that order', async () => {
    const html = await renderSiteVideo()
    const sources = [...html.matchAll(/<source[^>]*src="([^"]+)"/g)].map(
      (m) => m[1]
    )
    expect(sources).toEqual([
      'https://media.example.com/careers/hero-1280.webm',
      'https://media.example.com/careers/hero-1280.mp4'
    ])
  })

  it('is aria-hidden when no alt text is provided', async () => {
    const html = await renderSiteVideo()
    expect(html).toMatch(/aria-hidden="true"/)
  })

  it('exposes alt text as aria-label and drops aria-hidden when alt is set', async () => {
    const html = await renderSiteVideo({ alt: 'Comfy team walking' })
    expect(html).toMatch(/aria-label="Comfy team walking"/)
    expect(html).not.toMatch(/aria-hidden/)
  })
})
