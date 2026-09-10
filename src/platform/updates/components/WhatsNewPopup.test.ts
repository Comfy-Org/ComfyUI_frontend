// @vitest-environment jsdom
import type * as I18nModule from '@/i18n'
import type { ComfyApp } from '@/scripts/app'
import { useReleaseStore } from '../common/releaseStore'
beforeEach(() => {
  Object.assign(useReleaseStore(), {
    recentRelease: null as ReleaseNote | null
  })
  Object.assign(useReleaseStore(), { shouldShowPopup: false })
  vi.mocked(useReleaseStore().handleWhatsNewSeen).mockResolvedValue(undefined)
  Object.assign(useReleaseStore(), { releases: [] as ReleaseNote[] })
  vi.mocked(useReleaseStore().fetchReleases).mockResolvedValue(undefined)
})
// dompurify is inert under happy-dom — see the tripwire note in
// vitest.setup.ts (capricorn86/happy-dom#2182, FE-1189).
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import Button from '@/components/ui/button/Button.vue'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ReleaseNote } from '../common/releaseService'
import WhatsNewPopup from './WhatsNewPopup.vue'

vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

// Mock dependencies
const mockTranslations: Record<string, string> = {
  'g.close': 'Close',
  'whatsNewPopup.later': 'Later',
  'whatsNewPopup.learnMore': 'Learn More',
  'whatsNewPopup.noReleaseNotes': 'No release notes available'
}
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

vi.mock<unknown>(import('@/i18n'), async (importOriginal) => ({
  ...(await importOriginal<typeof I18nModule>()),
  i18n: {
    global: {
      locale: {
        value: 'en'
      }
    }
  },
  t: (key: string, params?: Record<string, string>) => {
    return params
      ? `${mockTranslations[key] || key}:${JSON.stringify(params)}`
      : mockTranslations[key] || key
  },
  d: (date: Date) => date.toLocaleDateString()
}))

vi.mock(import('@/utils/formatUtil'), () => ({
  formatVersionAnchor: vi.fn((version: string) => version.replace(/\./g, ''))
}))

vi.mock(import('@/utils/markdownRendererUtil'), () => ({
  renderMarkdownToHtml: vi.fn((content: string) => `<div>${content}</div>`)
}))

vi.mock(import('@/scripts/app'), async () => {
  const { fromPartial } = await import('@total-typescript/shoehorn')
  return { app: fromPartial<ComfyApp>({}) }
})

// Mock release store

describe('WhatsNewPopup', () => {
  const renderComponent = (props = {}) => {
    return render(WhatsNewPopup, {
      global: {
        plugins: [PrimeVue, i18n],
        components: { Button },
        stubs: {
          'i-lucide-x': true,
          'i-lucide-external-link': true
        }
      },
      props
    })
  }

  beforeEach(() => {
    Object.assign(useReleaseStore(), { recentRelease: null })
    Object.assign(useReleaseStore(), { shouldShowPopup: false })
    useReleaseStore().releases = []
    useReleaseStore().handleWhatsNewSeen = vi.fn()
    useReleaseStore().fetchReleases = vi.fn()
  })

  it('renders correctly when shouldShow is true', () => {
    Object.assign(useReleaseStore(), { shouldShowPopup: true })
    Object.assign(useReleaseStore(), {
      recentRelease: {
        version: '1.2.3',
        content: '# Test Release\n\nSome content'
      } as ReleaseNote
    })

    const { container } = renderComponent()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('.whats-new-popup')).not.toBeNull()
  })

  it('does not render when shouldShow is false', () => {
    Object.assign(useReleaseStore(), { shouldShowPopup: false })
    const { container } = renderComponent()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('.whats-new-popup')).toBeNull()
  })

  it('calls handleWhatsNewSeen when close button is clicked', async () => {
    Object.assign(useReleaseStore(), { shouldShowPopup: true })
    Object.assign(useReleaseStore(), {
      recentRelease: {
        version: '1.2.3',
        content: '# Test Release'
      } as ReleaseNote
    })

    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(useReleaseStore().handleWhatsNewSeen).toHaveBeenCalledWith('1.2.3')
  })

  it('generates correct changelog URL', () => {
    Object.assign(useReleaseStore(), { shouldShowPopup: true })
    Object.assign(useReleaseStore(), {
      recentRelease: {
        version: '1.2.3',
        content: '# Test Release'
      } as ReleaseNote
    })

    renderComponent()

    const learnMoreLink = screen.getByRole('link')
    expect(learnMoreLink.getAttribute('href')).toContain(
      'docs.comfy.org/changelog'
    )
  })

  it('handles missing release content gracefully', () => {
    Object.assign(useReleaseStore(), { shouldShowPopup: true })
    Object.assign(useReleaseStore(), {
      recentRelease: {
        version: '1.2.3',
        content: ''
      } as ReleaseNote
    })

    const { container } = renderComponent()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('.content-text')).not.toBeNull()
  })

  it('emits whats-new-dismissed event when popup is closed', async () => {
    Object.assign(useReleaseStore(), { shouldShowPopup: true })
    Object.assign(useReleaseStore(), {
      recentRelease: {
        version: '1.2.3',
        content: '# Test Release'
      } as ReleaseNote
    })

    const onDismissed = vi.fn()
    const user = userEvent.setup()
    renderComponent({ 'onWhats-new-dismissed': onDismissed })

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(onDismissed).toHaveBeenCalled()
  })

  it('fetches releases on mount when not already loaded', async () => {
    Object.assign(useReleaseStore(), { shouldShowPopup: true })
    useReleaseStore().releases = []

    renderComponent()

    expect(useReleaseStore().fetchReleases).toHaveBeenCalled()
  })

  it('does not fetch releases when already loaded', async () => {
    Object.assign(useReleaseStore(), { shouldShowPopup: true })
    useReleaseStore().releases = [{ version: '1.0.0' } as ReleaseNote]

    renderComponent()

    expect(useReleaseStore().fetchReleases).not.toHaveBeenCalled()
  })

  it('processes markdown content correctly', async () => {
    const mockMarkdownRendererModule = (await vi.importMock(
      '@/utils/markdownRendererUtil'
    )) as { renderMarkdownToHtml: ReturnType<typeof vi.fn> }
    const mockMarkdownRenderer = vi.mocked(
      mockMarkdownRendererModule.renderMarkdownToHtml
    )
    mockMarkdownRenderer.mockReturnValue('<h1>Processed Content</h1>')

    Object.assign(useReleaseStore(), { shouldShowPopup: true })
    Object.assign(useReleaseStore(), {
      recentRelease: {
        version: '1.2.3',
        content: '# Original Title\n\nContent'
      } as ReleaseNote
    })

    renderComponent()

    expect(mockMarkdownRenderer).toHaveBeenCalledWith(
      '# Original Title\n\nContent'
    )
  })
})
