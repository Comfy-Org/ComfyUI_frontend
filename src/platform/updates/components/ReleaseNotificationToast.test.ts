import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { ReleaseNote } from '../common/releaseService'
import ReleaseNotificationToast from './ReleaseNotificationToast.vue'

const mockData = vi.hoisted(() => ({ isDesktop: false }))

const { commandExecuteMock } = vi.hoisted(() => ({
  commandExecuteMock: vi.fn()
}))

const { toastErrorHandlerMock } = vi.hoisted(() => ({
  toastErrorHandlerMock: vi.fn()
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false,
  isNightly: false,
  get isDesktop() {
    return mockData.isDesktop
  }
}))

// Mock dependencies
vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    locale: { value: 'en' },
    t: vi.fn((key: string) => {
      const translations: Record<string, string> = {
        'releaseToast.newVersionAvailable': 'New update is out!',
        'releaseToast.whatsNew': "See what's new",
        'releaseToast.skip': 'Skip',
        'releaseToast.update': 'Update',
        'releaseToast.description':
          'Check out the latest improvements and features in this update.'
      }
      return translations[key] || key
    })
  })),
  createI18n: vi.fn(() => ({
    global: {
      locale: { value: 'en' }
    }
  }))
}))

vi.mock('@/utils/formatUtil', () => ({
  formatVersionAnchor: vi.fn((version: string) => version.replace(/\./g, ''))
}))

vi.mock('@/utils/markdownRendererUtil', () => ({
  renderMarkdownToHtml: vi.fn((content: string) => `<div>${content}</div>`)
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: vi.fn(() => ({
    toastErrorHandler: toastErrorHandlerMock
  }))
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: vi.fn(() => ({
    execute: commandExecuteMock
  }))
}))

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: vi.fn(() => ({
    buildDocsUrl: vi.fn((path: string) => `https://docs.comfy.org${path}`),
    staticUrls: {},
    docsPaths: {}
  }))
}))

// Mock release store
const mockReleaseStore = {
  recentRelease: null as ReleaseNote | null,
  shouldShowToast: false,
  handleSkipRelease: vi.fn(),
  handleShowChangelog: vi.fn(),
  releases: [],
  fetchReleases: vi.fn()
}

vi.mock('../common/releaseStore', () => ({
  useReleaseStore: vi.fn(() => mockReleaseStore)
}))

describe('ReleaseNotificationToast', () => {
  const renderComponent = (props = {}) => {
    return render(ReleaseNotificationToast, {
      global: {
        mocks: {
          $t: (key: string) => {
            const translations: Record<string, string> = {
              'releaseToast.newVersionAvailable': 'New update is out!',
              'releaseToast.whatsNew': "See what's new",
              'releaseToast.skip': 'Skip',
              'releaseToast.update': 'Update',
              'releaseToast.description':
                'Check out the latest improvements and features in this update.'
            }
            return translations[key] || key
          }
        },
        stubs: {
          'i-lucide-rocket': true,
          'i-lucide-external-link': true
        }
      },
      props
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockData.isDesktop = false
    mockReleaseStore.recentRelease = null
    mockReleaseStore.shouldShowToast = true
  })

  it('renders correctly when shouldShow is true', () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release\n\nSome content'
    } as ReleaseNote

    const { container } = renderComponent()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('.release-toast-popup')).toBeInTheDocument()
  })

  it('displays rocket icon', () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    const { container } = renderComponent()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('.release-toast-popup')).toBeInTheDocument()
  })

  it('displays release version', () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    renderComponent()
    expect(screen.getByText('1.2.3')).toBeInTheDocument()
  })

  it('calls handleSkipRelease when skip button is clicked', async () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    renderComponent()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /skip/i }))

    expect(mockReleaseStore.handleSkipRelease).toHaveBeenCalledWith('1.2.3')
  })

  it('opens update URL when update button is clicked', async () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    const mockWindowOpen = vi.fn()
    Object.defineProperty(window, 'open', {
      value: mockWindowOpen,
      writable: true
    })

    renderComponent()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /update/i }))

    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://docs.comfy.org/installation/update_comfyui',
      '_blank'
    )
  })

  it('executes desktop updater flow when running on desktop', async () => {
    mockData.isDesktop = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    commandExecuteMock.mockResolvedValueOnce(undefined)

    const mockWindowOpen = vi.fn()
    Object.defineProperty(window, 'open', {
      value: mockWindowOpen,
      writable: true
    })

    renderComponent()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /update/i }))

    expect(commandExecuteMock).toHaveBeenCalledWith(
      'Comfy-Desktop.CheckForUpdates'
    )
    expect(mockWindowOpen).not.toHaveBeenCalled()
    expect(toastErrorHandlerMock).not.toHaveBeenCalled()
  })

  it('shows an error toast if the desktop updater flow fails on desktop', async () => {
    mockData.isDesktop = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    const error = new Error('Command Comfy-Desktop.CheckForUpdates not found')
    commandExecuteMock.mockRejectedValueOnce(error)

    const mockWindowOpen = vi.fn()
    Object.defineProperty(window, 'open', {
      value: mockWindowOpen,
      writable: true
    })

    renderComponent()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /update/i }))

    expect(toastErrorHandlerMock).toHaveBeenCalledWith(error)
    expect(mockWindowOpen).not.toHaveBeenCalled()
  })

  it('calls handleShowChangelog when learn more link is clicked', async () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    renderComponent()
    const user = userEvent.setup()

    await user.click(screen.getByRole('link', { name: /what's new/i }))

    expect(mockReleaseStore.handleShowChangelog).toHaveBeenCalledWith('1.2.3')
  })

  it('generates correct changelog URL', () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    renderComponent()

    const learnMoreLink = screen.getByRole('link', { name: /what's new/i })
    expect(learnMoreLink).toHaveAttribute(
      'href',
      expect.stringContaining('docs.comfy.org/changelog')
    )
  })

  it('removes title from markdown content for toast display', async () => {
    const mockMarkdownRendererModule = (await vi.importMock(
      '@/utils/markdownRendererUtil'
    )) as { renderMarkdownToHtml: ReturnType<typeof vi.fn> }
    const mockMarkdownRenderer = vi.mocked(
      mockMarkdownRendererModule.renderMarkdownToHtml
    )
    mockMarkdownRenderer.mockReturnValue('<div>Content without title</div>')

    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release Title\n\nSome content'
    } as ReleaseNote

    renderComponent()

    expect(mockMarkdownRenderer).toHaveBeenCalledWith('\n\nSome content')
  })

  it('fetches releases on mount when not already loaded', () => {
    mockReleaseStore.releases = []

    renderComponent()

    expect(mockReleaseStore.fetchReleases).toHaveBeenCalled()
  })

  it('handles missing release content gracefully', () => {
    mockReleaseStore.shouldShowToast = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: ''
    } as ReleaseNote

    const { container } = renderComponent()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const descriptionElement = container.querySelector('.pl-14')
    expect(descriptionElement).toBeInTheDocument()
    expect(descriptionElement).toHaveTextContent('Check out the latest')
  })

  it('auto-hides after timeout', async () => {
    vi.useFakeTimers()

    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    const { container } = renderComponent()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('.release-toast-popup')).toBeInTheDocument()

    vi.advanceTimersByTime(8000)
    await nextTick()

    expect(vi.getTimerCount()).toBe(0)

    vi.useRealTimers()
  })

  it('clears auto-hide timer when manually dismissed', async () => {
    vi.useFakeTimers()

    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    renderComponent()

    vi.advanceTimersByTime(1000)

    await user.click(screen.getByRole('button', { name: /skip/i }))

    expect(vi.getTimerCount()).toBe(0)
    expect(mockReleaseStore.handleSkipRelease).toHaveBeenCalled()

    vi.useRealTimers()
  })
})
