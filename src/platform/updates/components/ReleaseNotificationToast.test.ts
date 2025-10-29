import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { ReleaseNote } from '../common/releaseService'
import ReleaseNotificationToast from './ReleaseNotificationToast.vue'

// Mock dependencies
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

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  const mountComponent = (props = {}) => {
    return mount(ReleaseNotificationToast, {
      global: {
        plugins: [i18n],
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
    vi.stubGlobal('window', { open: mockWindowOpen })

    wrapper = mountComponent()
    
    const updateButton = wrapper.find('.action-primary')
    await updateButton.trigger('click')
    
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
    
    const learnMoreLink = wrapper.find('.learn-more-link')
    await learnMoreLink.trigger('click')
    
    expect(mockReleaseStore.handleShowChangelog).toHaveBeenCalledWith('1.2.3')
  })

  it('generates correct changelog URL', () => {
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    wrapper = mountComponent()
    
    const learnMoreLink = wrapper.find('.learn-more-link')
    expect(learnMoreLink.attributes('href')).toContain('docs.comfy.org/changelog')
  })

  it('removes title from markdown content for toast display', () => {
    const mockMarkdownRenderer = vi.mocked(vi.importMock('@/utils/markdownRendererUtil')).renderMarkdownToHtml
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
    
    // Fast-forward time
    vi.advanceTimersByTime(8000)
    await wrapper.vm.$nextTick()
    
    // Should be dismissed
    expect(wrapper.find('.release-notification-toast').exists()).toBe(false)
    
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
    
    // Manually dismiss by clicking skip
    const skipButton = wrapper.find('.action-secondary')
    await skipButton.trigger('click')
    
    // Timer should be cleared, so advancing time shouldn't auto-dismiss
    vi.advanceTimersByTime(10000)
    await wrapper.vm.$nextTick()
    
    // Verify the store method was called (manual dismissal)
    expect(mockReleaseStore.handleSkipRelease).toHaveBeenCalled()
    
    vi.useRealTimers()
  })
})