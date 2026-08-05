import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import CloudTemplate from './CloudTemplate.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { comfyOrgLogoAlt: 'ComfyOrg Logo' } } }
})

/**
 * Drives the real `useMediaQuery`, so the breakpoint the component asks for is
 * part of what these tests pin rather than something a mock papers over.
 */
function stubViewportWidth(pixels: number) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const minWidth = /min-width:\s*([\d.]+)(px|rem)/.exec(query)
      const threshold = minWidth
        ? Number(minWidth[1]) * (minWidth[2] === 'rem' ? 16 : 1)
        : 0
      return {
        matches: pixels >= threshold,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }
    })
  )
}

const renderWithMeta = async (meta: Record<string, unknown>) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'test', component: CloudTemplate, meta }]
  })
  await router.push('/')
  await router.isReady()
  return render(CloudTemplate, {
    global: {
      plugins: [router, i18n],
      stubs: {
        CloudHeroCarousel: { template: '<div data-testid="hero" />' },
        CloudTemplateFooter: { template: '<div data-testid="footer" />' },
        CloudTermsNotice: { template: '<div data-testid="terms" />' }
      }
    }
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CloudTemplate', () => {
  it('shows the hero carousel on a wide viewport', async () => {
    stubViewportWidth(1280)
    await renderWithMeta({})
    expect(screen.getByTestId('hero')).toBeInTheDocument()
  })

  it('hides the hero carousel when route.meta.hideHero is set', async () => {
    stubViewportWidth(1280)
    await renderWithMeta({ hideHero: true })
    expect(screen.queryByTestId('hero')).not.toBeInTheDocument()
  })

  it('does not mount the hero carousel on a tablet-width viewport', async () => {
    stubViewportWidth(1024)
    await renderWithMeta({})
    expect(
      screen.queryByTestId('hero'),
      'mounting below `xl` would download the hero video on devices that never display it'
    ).not.toBeInTheDocument()
  })

  it('swaps the footer for the terms notice when the route asks for it', async () => {
    stubViewportWidth(1280)
    await renderWithMeta({ showTermsNotice: true })
    expect(screen.getByTestId('terms')).toBeInTheDocument()
    expect(
      screen.queryByTestId('footer'),
      'the notice and the generic footer are alternatives, never both'
    ).not.toBeInTheDocument()
  })

  it('shows the generic footer by default', async () => {
    stubViewportWidth(1280)
    await renderWithMeta({})
    expect(screen.getByTestId('footer')).toBeInTheDocument()
    expect(screen.queryByTestId('terms')).not.toBeInTheDocument()
  })
})
