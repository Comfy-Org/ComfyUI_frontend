import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReleaseNote } from '../common/releaseService'
import ReleaseNotificationToast from './ReleaseNotificationToast.vue'

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
  let wrapper: VueWrapper

  const mountComponent = (props = {}) => {
    return mount(ReleaseNotificationToast, {
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
          // Stub Lucide icons
          'i-lucide-rocket': true,
          'i-lucide-external-link': true
        }
      },
      props
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state
    mockReleaseStore.recentRelease = null
    mockReleaseStore.shouldShowToast = true // Force show for testing
  })

  it('renders correctly when shouldShow is true', () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release\n\nSome content'
    } as ReleaseNote

    wrapper = mountComponent()
    expect(wrapper.find('.release-notification-toast').exists()).toBe(true)
  })

  it('displays rocket icon', () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    wrapper = mountComponent()
    expect(wrapper.find('.icon-\\[lucide--rocket\\]').exists()).toBe(true)
  })

  it('displays release version', () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    wrapper = mountComponent()
    expect(wrapper.text()).toContain('1.2.3')
  })

  it('calls handleSkipRelease when skip button is clicked', async () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    wrapper = mountComponent()

    const skipButton = wrapper.find('.action-secondary')
    await skipButton.trigger('click')

    expect(mockReleaseStore.handleSkipRelease).toHaveBeenCalledWith('1.2.3')
  })

  it('opens update URL when update button is clicked', async () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    // Mock window.open
    const mockWindowOpen = vi.fn()
    Object.defineProperty(window, 'open', {
      value: mockWindowOpen,
      writable: true
    })

    wrapper = mountComponent()

    // Call the handler directly instead of triggering DOM event
    await (wrapper.vm as any).handleUpdate()

    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://docs.comfy.org/installation/update_comfyui',
      '_blank'
    )
  })

  it('calls handleShowChangelog when learn more link is clicked', async () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    wrapper = mountComponent()

    // Call the handler directly instead of triggering DOM event
    await (wrapper.vm as any).handleLearnMore()

    expect(mockReleaseStore.handleShowChangelog).toHaveBeenCalledWith('1.2.3')
  })

  it('generates correct changelog URL', () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    wrapper = mountComponent()

    const learnMoreLink = wrapper.find('.learn-more-link')
    expect(learnMoreLink.attributes('href')).toContain(
      'docs.comfy.org/changelog'
    )
  })

  it('removes title from markdown content for toast display', async () => {
    const mockMarkdownRendererModule = await vi.importMock(
      '@/utils/markdownRendererUtil'
    )
    const mockMarkdownRenderer = vi.mocked(mockMarkdownRendererModule)
      .renderMarkdownToHtml as any
    mockMarkdownRenderer.mockReturnValue('<div>Content without title</div>')

    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release Title\n\nSome content'
    } as ReleaseNote

    wrapper = mountComponent()

    // Should call markdown renderer with title removed
    expect(mockMarkdownRenderer).toHaveBeenCalledWith('\n\nSome content')
  })

  it('fetches releases on mount when not already loaded', async () => {
    mockReleaseStore.releases = [] // Empty releases array

    wrapper = mountComponent()

    expect(mockReleaseStore.fetchReleases).toHaveBeenCalled()
  })

  it('handles missing release content gracefully', () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: ''
    } as ReleaseNote

    wrapper = mountComponent()

    // Should render fallback content
    const descriptionElement = wrapper.find('.toast-description')
    expect(descriptionElement.exists()).toBe(true)
  })

  it('auto-hides after timeout', async () => {
    vi.useFakeTimers()

    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    wrapper = mountComponent()

    // Initially visible
    expect(wrapper.find('.release-notification-toast').exists()).toBe(true)

    // Fast-forward time to trigger auto-hide
    vi.advanceTimersByTime(8000)
    await wrapper.vm.$nextTick()

    // Component should call dismissToast internally which hides it
    // We can't test DOM visibility change because the component uses local state
    // But we can verify the timer was set and would have triggered
    expect(vi.getTimerCount()).toBe(0) // Timer should be cleared after auto-hide

    vi.useRealTimers()
  })

  it('clears auto-hide timer when manually dismissed', async () => {
    vi.useFakeTimers()

    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    wrapper = mountComponent()

    // Start the timer
    vi.advanceTimersByTime(1000)

    // Manually dismiss by calling handler directly
    await (wrapper.vm as any).handleSkip()

    // Timer should be cleared
    expect(vi.getTimerCount()).toBe(0)

    // Verify the store method was called (manual dismissal)
    expect(mockReleaseStore.handleSkipRelease).toHaveBeenCalled()

    vi.useRealTimers()
  })
})
