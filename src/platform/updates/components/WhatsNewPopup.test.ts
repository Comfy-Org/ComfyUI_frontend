import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import Button from 'primevue/button'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { ReleaseNote } from '../common/releaseService'
import WhatsNewPopup from './WhatsNewPopup.vue'

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
  shouldShowPopup: false,
  handleWhatsNewSeen: vi.fn(),
  releases: [],
  fetchReleases: vi.fn()
}

vi.mock('../common/releaseStore', () => ({
  useReleaseStore: vi.fn(() => mockReleaseStore)
}))

describe('WhatsNewPopup', () => {
  let wrapper: VueWrapper

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  const mountComponent = (props = {}) => {
    return mount(WhatsNewPopup, {
      global: {
        plugins: [PrimeVue, i18n],
        components: { Button },
        stubs: {
          // Stub Lucide icons
          'i-lucide-x': true,
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
    mockReleaseStore.shouldShowPopup = false
  })

  it('renders correctly when shouldShow is true', () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release\n\nSome content'
    } as ReleaseNote

    wrapper = mountComponent()
    expect(wrapper.find('.whats-new-popup').exists()).toBe(true)
  })

  it('does not render when shouldShow is false', () => {
    mockReleaseStore.shouldShowPopup = false
    wrapper = mountComponent()
    expect(wrapper.find('.whats-new-popup').exists()).toBe(false)
  })

  it('calls handleWhatsNewSeen when close button is clicked', async () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    wrapper = mountComponent()
    
    const closeButton = wrapper.findComponent(Button)
    await closeButton.trigger('click')
    
    expect(mockReleaseStore.handleWhatsNewSeen).toHaveBeenCalledWith('1.2.3')
  })

  it('opens update URL when CTA button is clicked', async () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    // Mock window.open
    const mockWindowOpen = vi.fn()
    vi.stubGlobal('window', { open: mockWindowOpen })

    wrapper = mountComponent()
    
    const ctaButton = wrapper.find('.action-primary')
    await ctaButton.trigger('click')
    
    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://docs.comfy.org/installation/update_comfyui',
      '_blank'
    )
  })

  it('generates correct changelog URL', () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    wrapper = mountComponent()
    
    const learnMoreLink = wrapper.find('.learn-more-link')
    expect(learnMoreLink.attributes('href')).toContain('docs.comfy.org/changelog')
  })

  it('handles missing release content gracefully', () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: ''
    } as ReleaseNote

    wrapper = mountComponent()
    
    // Should render fallback content
    const contentElement = wrapper.find('.content-text')
    expect(contentElement.exists()).toBe(true)
  })

  it('emits whats-new-dismissed event when popup is closed', async () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Test Release'
    } as ReleaseNote

    wrapper = mountComponent()
    
    const closeButton = wrapper.findComponent(Button)
    await closeButton.trigger('click')
    
    expect(wrapper.emitted('whats-new-dismissed')).toBeTruthy()
  })

  it('fetches releases on mount when not already loaded', async () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.releases = [] // Empty releases array
    
    wrapper = mountComponent()
    
    expect(mockReleaseStore.fetchReleases).toHaveBeenCalled()
  })

  it('does not fetch releases when already loaded', async () => {
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.releases = [{ version: '1.0.0' }] // Non-empty releases array
    
    wrapper = mountComponent()
    
    expect(mockReleaseStore.fetchReleases).not.toHaveBeenCalled()
  })

  it('processes markdown content correctly', () => {
    const mockMarkdownRenderer = vi.mocked(vi.importMock('@/utils/markdownRendererUtil')).renderMarkdownToHtml
    mockMarkdownRenderer.mockReturnValue('<h1>Processed Content</h1>')
    
    mockReleaseStore.shouldShowPopup = true
    mockReleaseStore.recentRelease = {
      version: '1.2.3',
      content: '# Original Title\n\nContent'
    } as ReleaseNote

    wrapper = mountComponent()
    
    // Should call markdown renderer with modified content
    expect(mockMarkdownRenderer).toHaveBeenCalledWith(
      expect.stringContaining("What's new in our latest update (1.2.3)")
    )
  })
})