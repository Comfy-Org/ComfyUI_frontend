import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  DeveloperProfile,
  MarketplaceTemplate,
  TemplateReview,
  TemplateRevenue
} from '@/types/templateMarketplace'

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    watchDebounced: vi.fn((source: unknown, cb: unknown, opts: unknown) => {
      const typedActual = actual as {
        watchDebounced: (...args: unknown[]) => unknown
      }
      return typedActual.watchDebounced(source, cb, {
        ...(opts as object),
        debounce: 0
      })
    })
  }
})

const stubProfile: DeveloperProfile = {
  username: '@StoneCypher',
  displayName: 'Stone Cypher',
  avatarUrl: undefined,
  bannerUrl: undefined,
  bio: 'Workflow designer',
  isVerified: true,
  monetizationEnabled: true,
  joinedAt: new Date('2024-03-15'),
  dependencies: 371,
  totalDownloads: 1000,
  totalFavorites: 50,
  averageRating: 4.2,
  templateCount: 2
}

const stubReviews: TemplateReview[] = [
  {
    id: 'rev-1',
    authorName: 'Reviewer',
    rating: 4.5,
    text: 'Great work!',
    createdAt: new Date('2025-10-01'),
    templateId: 'tpl-1'
  }
]

const stubTemplate: MarketplaceTemplate = {
  id: 'tpl-1',
  title: 'Test Template',
  description: 'Desc',
  shortDescription: 'Short',
  author: {
    id: 'usr-1',
    name: 'Stone Cypher',
    isVerified: true,
    profileUrl: '/u'
  },
  categories: [],
  tags: [],
  difficulty: 'beginner',
  requiredModels: [],
  requiredNodes: [],
  requiresCustomNodes: [],
  vramRequirement: 0,
  thumbnail: '',
  gallery: [],
  workflowPreview: '',
  license: 'mit',
  version: '1.0.0',
  status: 'approved',
  updatedAt: new Date(),
  stats: {
    downloads: 500,
    favorites: 30,
    rating: 4,
    reviewCount: 5,
    weeklyTrend: 1
  }
}

const stubRevenue: TemplateRevenue[] = [
  {
    templateId: 'tpl-1',
    totalRevenue: 5000,
    monthlyRevenue: 500,
    currency: 'USD'
  }
]

const mockService = vi.hoisted(() => ({
  getCurrentUsername: vi.fn(() => '@StoneCypher'),
  fetchDeveloperProfile: vi.fn(() => Promise.resolve({ ...stubProfile })),
  fetchDeveloperReviews: vi.fn(() => Promise.resolve([...stubReviews])),
  fetchPublishedTemplates: vi.fn(() => Promise.resolve([{ ...stubTemplate }])),
  fetchTemplateRevenue: vi.fn(() => Promise.resolve([...stubRevenue])),
  fetchDownloadHistory: vi.fn(() => Promise.resolve([])),
  unpublishTemplate: vi.fn(() => Promise.resolve()),
  saveDeveloperProfile: vi.fn((p: Partial<DeveloperProfile>) =>
    Promise.resolve({ ...stubProfile, ...p })
  )
}))

vi.mock('@/services/developerProfileService', () => mockService)

import DeveloperProfileDialog from './DeveloperProfileDialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      developerProfile: {
        dialogTitle: 'Developer Profile',
        username: 'Username',
        bio: 'Bio',
        reviews: 'Reviews',
        publishedTemplates: 'Published Templates',
        dependencies: 'Dependencies',
        totalDownloads: 'Downloads',
        totalFavorites: 'Favorites',
        averageRating: 'Avg. Rating',
        templateCount: 'Templates',
        revenue: 'Revenue',
        monthlyRevenue: 'Monthly',
        totalRevenue: 'Total',
        noReviews: 'No reviews yet',
        noTemplates: 'No published templates yet',
        unpublish: 'Unpublish',
        save: 'Save Profile',
        saving: 'Saving...',
        verified: 'Verified',
        quickActions: 'Quick Actions',
        bannerPlaceholder: 'Banner image',
        editUsername: 'Edit username',
        editBio: 'Edit bio',
        lookupHandle: 'Enter developer handle\u2026',
        downloads: 'Downloads',
        favorites: 'Favorites',
        rating: 'Rating'
      }
    }
  }
})

function mountDialog(props?: { username?: string }) {
  return mount(DeveloperProfileDialog, {
    props: {
      onClose: vi.fn(),
      ...props
    },
    global: {
      plugins: [i18n],
      stubs: {
        BaseModalLayout: {
          template: `
            <div data-testid="modal">
              <div data-testid="header"><slot name="header" /></div>
              <div data-testid="header-right"><slot name="header-right-area" /></div>
              <div data-testid="content"><slot name="content" /></div>
            </div>
          `
        },
        ReviewCard: {
          template: '<div data-testid="review-card" />',
          props: ['review']
        },
        TemplateListItem: {
          template:
            '<div data-testid="template-list-item" :data-show-revenue="showRevenue" :data-is-current-user="isCurrentUser" />',
          props: ['template', 'revenue', 'showRevenue', 'isCurrentUser']
        },
        DownloadHistoryChart: {
          template: '<div data-testid="download-history-chart" />',
          props: ['entries']
        },
        Button: {
          template: '<button><slot /></button>',
          props: ['variant', 'size', 'disabled']
        }
      }
    }
  })
}

describe('DeveloperProfileDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockService.getCurrentUsername.mockReturnValue('@StoneCypher')
    mockService.fetchDeveloperProfile.mockResolvedValue({ ...stubProfile })
    mockService.fetchDeveloperReviews.mockResolvedValue([...stubReviews])
    mockService.fetchPublishedTemplates.mockResolvedValue([{ ...stubTemplate }])
    mockService.fetchTemplateRevenue.mockResolvedValue([...stubRevenue])
  })

  it('renders the banner section', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    expect(wrapper.find('[data-testid="banner-section"]').exists()).toBe(true)
  })

  it('shows username input when viewing own profile', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    expect(wrapper.find('[data-testid="username-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="username-text"]').exists()).toBe(false)
  })

  it('shows username text when viewing another profile', async () => {
    const wrapper = mountDialog({ username: '@OtherUser' })
    await flushPromises()
    expect(wrapper.find('[data-testid="username-text"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="username-input"]').exists()).toBe(false)
  })

  it('shows bio input when viewing own profile', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    expect(wrapper.find('[data-testid="bio-input"]').exists()).toBe(true)
  })

  it('shows bio text when viewing another profile', async () => {
    const wrapper = mountDialog({ username: '@OtherUser' })
    await flushPromises()
    expect(wrapper.find('[data-testid="bio-text"]').exists()).toBe(true)
  })

  it('renders review cards', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="review-card"]')).toHaveLength(1)
  })

  it('renders template list items', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="template-list-item"]')).toHaveLength(
      1
    )
  })

  it('passes showRevenue=true when current user with monetization', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const item = wrapper.find('[data-testid="template-list-item"]')
    expect(item.attributes('data-show-revenue')).toBe('true')
  })

  it('passes showRevenue=false when not current user', async () => {
    const wrapper = mountDialog({ username: '@OtherUser' })
    await flushPromises()
    const item = wrapper.find('[data-testid="template-list-item"]')
    expect(item.attributes('data-show-revenue')).toBe('false')
  })

  it('shows quick actions when viewing own profile', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    expect(wrapper.find('[data-testid="quick-actions"]').exists()).toBe(true)
  })

  it('hides quick actions when viewing another profile', async () => {
    const wrapper = mountDialog({ username: '@OtherUser' })
    await flushPromises()
    expect(wrapper.find('[data-testid="quick-actions"]').exists()).toBe(false)
  })

  it('shows save button when viewing own profile', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const headerRight = wrapper.find('[data-testid="header-right"]')
    expect(headerRight.text()).toContain('Save Profile')
  })

  it('hides save button when viewing another profile', async () => {
    const wrapper = mountDialog({ username: '@OtherUser' })
    await flushPromises()
    const headerRight = wrapper.find('[data-testid="header-right"]')
    expect(headerRight.text()).not.toContain('Save Profile')
  })

  it('renders summary stats', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const stats = wrapper.find('[data-testid="summary-stats"]')
    expect(stats.exists()).toBe(true)
    expect(stats.text()).toContain('371')
    expect(stats.text()).toContain('1,000')
    expect(stats.text()).toContain('50')
  })

  it('renders the handle input with the default username', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const handleInput = wrapper.find('[data-testid="handle-input"]')
    expect(handleInput.exists()).toBe(true)
    expect((handleInput.element as HTMLInputElement).value).toBe('@StoneCypher')
  })

  it('reloads data when the handle input changes', async () => {
    const otherProfile: DeveloperProfile = {
      ...stubProfile,
      username: '@OtherDev',
      displayName: 'Other Dev',
      bio: 'Another developer',
      isVerified: false,
      monetizationEnabled: false,
      totalDownloads: 42
    }
    const wrapper = mountDialog()
    await flushPromises()

    // Initial load
    expect(mockService.fetchDeveloperProfile).toHaveBeenCalledWith(
      '@StoneCypher'
    )
    vi.clearAllMocks()

    mockService.fetchDeveloperProfile.mockResolvedValue(otherProfile)
    mockService.fetchDeveloperReviews.mockResolvedValue([])
    mockService.fetchPublishedTemplates.mockResolvedValue([])

    const handleInput = wrapper.find('[data-testid="handle-input"]')
    await handleInput.setValue('@OtherDev')
    await flushPromises()

    expect(mockService.fetchDeveloperProfile).toHaveBeenCalledWith('@OtherDev')
    expect(wrapper.find('[data-testid="username-text"]').text()).toBe(
      'Other Dev'
    )
  })

  it('clears revenue when switching to a non-current-user handle', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    // Revenue was loaded for current user
    expect(mockService.fetchTemplateRevenue).toHaveBeenCalled()
    vi.clearAllMocks()

    const otherProfile: DeveloperProfile = {
      ...stubProfile,
      username: '@Someone',
      monetizationEnabled: false
    }
    mockService.fetchDeveloperProfile.mockResolvedValue(otherProfile)
    mockService.fetchDeveloperReviews.mockResolvedValue([])
    mockService.fetchPublishedTemplates.mockResolvedValue([])

    const handleInput = wrapper.find('[data-testid="handle-input"]')
    await handleInput.setValue('@Someone')
    await flushPromises()

    // Revenue should NOT be fetched for other user
    expect(mockService.fetchTemplateRevenue).not.toHaveBeenCalled()
    // showRevenue should be false
    const item = wrapper.find('[data-testid="template-list-item"]')
    expect(item.exists()).toBe(false)
  })
})
