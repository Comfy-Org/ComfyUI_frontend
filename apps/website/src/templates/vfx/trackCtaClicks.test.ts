import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { captureVfxLandingCtaClicked } from '@/scripts/posthog'
import { trackVfxCtaClicks } from './trackCtaClicks'

vi.mock(import('@/scripts/posthog'))

const Page = defineComponent({
  template: `
    <div>
      <div data-vfx-cta>
        <a href="/contact/?utm_source=linkedin">Request demo</a>
      </div>
      <a href="/contact/">Elsewhere</a>
    </div>
  `
})

describe('trackVfxCtaClicks', () => {
  let stop: () => void

  beforeEach(() => {
    render(Page)
    stop = trackVfxCtaClicks()
  })

  afterEach(() => {
    stop()
  })

  it('reports a click on a link inside a marked region', async () => {
    await userEvent.click(screen.getByRole('link', { name: 'Request demo' }))

    expect(captureVfxLandingCtaClicked).toHaveBeenCalledTimes(1)
  })

  it('ignores links outside a marked region', async () => {
    await userEvent.click(screen.getByRole('link', { name: 'Elsewhere' }))

    expect(captureVfxLandingCtaClicked).not.toHaveBeenCalled()
  })

  it('leaves the link and its query string untouched', async () => {
    const link = screen.getByRole('link', { name: 'Request demo' })
    await userEvent.click(link)

    expect(link.getAttribute('href')).toBe('/contact/?utm_source=linkedin')
  })

  it('stops reporting once removed', async () => {
    stop()
    await userEvent.click(screen.getByRole('link', { name: 'Request demo' }))

    expect(captureVfxLandingCtaClicked).not.toHaveBeenCalled()
  })
})
