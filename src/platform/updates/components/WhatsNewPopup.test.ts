/* eslint-disable testing-library/no-container */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import Button from '@/components/ui/button/Button.vue'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReleaseNote } from '../common/releaseService'
import WhatsNewPopup from './WhatsNewPopup.vue'

// Mock dependencies
const mockTranslations: Record<string, string> = {
  'g.close': 'Close',
  'whatsNewPopup.later': 'Later',
  'whatsNewPopup.learnMore': 'Learn More',
  'whatsNewPopup.noReleaseNotes': 'No release notes available'
}

vi.mock('@/i18n', () => ({
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

vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    locale: { value: 'en' },
    t: vi.fn((key: string) => {
      return mockTranslations[key] || key
    })
  }))
}))

vi.mock('@/utils/formatUtil', () => ({
  formatVersionAnchor: vi.fn((version: string) => version.replace(/\./g, ''))
}))

vi.mock('@/utils/markdownRendererUtil', () => ({
  renderMarkdownToHtml: vi.fn((content: string) => `<div>${content}</div>`)
}))

// Mock release store
const mockReleaseStore = {
  recentRelease: null as ReleaseNote | null,
  shouldShowPopup: false,
  handleWhatsNewSeen: vi.fn(),
  releases: [] as ReleaseNote[],
  fetchReleases: vi.fn()
}

vi.mock('../common/releaseStore', () => ({
  useReleaseStore: vi.fn(() => mockReleaseStore)
}))

describe('WhatsNewPopup', () => {
  const renderComponent = (props = {}) => {
    return render(WhatsNewPopup, {
      global: {
        plugins: [PrimeVue],
        components: { Button },
        mocks: {
          $t: (key: string) => {
            return mockTranslations[key] || key
          }
        },
        stubs: {
          'i-lucide-x': true,
          'i-lucide-external-link': true
        }
      },
      props
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockReleaseStore.recentRelease = null
    mockReleaseStore.shouldShowPopup = false
    mockReleaseStore.releases = []
    mockReleaseStore.handleWhatsNewSeen = vi.fn()
    mockReleaseStore.fetchReleases = vi.fn()
  })

  it('renders correctly when shouldShow is true', () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release\n\nSome content'
    } as ReleaseNote

    const { container } = renderComponent()
    /* eslint-disable testing-library/no-node-access */
    expect(container.querySelector('.whats-new-popup')).not.toBeNull()
    /* eslint-enable testing-library/no-node-access */
  })

  it('does not render when shouldShow is false', () => {
    mockReleaseStore.shouldShowPopup = false
    const { container } = renderComponent()
    /* eslint-disable testing-library/no-node-access */
    expect(container.querySelector('.whats-new-popup')).toBeNull()
    /* eslint-enable testing-library/no-node-access */
  })

  it('calls handleWhatsNewSeen when close button is clicked', async () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(mockReleaseStore.handleWhatsNewSeen).toHaveBeenCalledWith('1.2.3')
  })

  it('generates correct changelog URL', () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    renderComponent()

    const learnMoreLink = screen.getByRole('link')
    expect(learnMoreLink.getAttribute('href')).toContain(
      'docs.comfy.org/changelog'
    )
  })

  it('handles missing release content gracefully', () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: ''
    } as ReleaseNote

    const { container } = renderComponent()

    /* eslint-disable testing-library/no-node-access */
    expect(container.querySelector('.content-text')).not.toBeNull()
    /* eslint-enable testing-library/no-node-access */
  })

  it('emits whats-new-dismissed event when popup is closed', async () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    const onDismissed = vi.fn()
    const user = userEvent.setup()
    renderComponent({ 'onWhats-new-dismissed': onDismissed })

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(onDismissed).toHaveBeenCalled()
  })

  it('fetches releases on mount when not already loaded', async () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.releases = []

    renderComponent()

    expect(mockReleaseStore.fetchReleases).toHaveBeenCalled()
  })

  it('does not fetch releases when already loaded', async () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.releases = [{ version: '1.0.0' } as ReleaseNote]

    renderComponent()

    expect(mockReleaseStore.fetchReleases).not.toHaveBeenCalled()
  })

  it('processes markdown content correctly', async () => {
    const mockMarkdownRendererModule = (await vi.importMock(
      '@/utils/markdownRendererUtil'
    )) as { renderMarkdownToHtml: ReturnType<typeof vi.fn> }
    const mockMarkdownRenderer = vi.mocked(
      mockMarkdownRendererModule.renderMarkdownToHtml
    )
    mockMarkdownRenderer.mockReturnValue('<h1>Processed Content</h1>')

    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Original Title\n\nContent'
    } as ReleaseNote

    renderComponent()

    expect(mockMarkdownRenderer).toHaveBeenCalledWith(
      '# Original Title\n\nContent'
    )
  })
})
