import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type {
  AuthorStats,
  AuthorTemplatesResponse,
  MarketplaceTemplate
} from '@/platform/marketplace/apiTypes'

const mockService = vi.hoisted(() => ({
  getAuthorTemplates: vi.fn(),
  getAuthorStats: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  submitTemplate: vi.fn(),
  uploadTemplateMedia: vi.fn(),
  getCategories: vi.fn(),
  suggestTags: vi.fn()
}))

vi.mock('@/platform/marketplace/services/marketplaceService', () => ({
  marketplaceService: mockService
}))

const { default: AuthorDashboard } =
  await import('@/platform/marketplace/components/AuthorDashboard.vue')

function makeSeedTemplate(
  overrides: Partial<MarketplaceTemplate>
): MarketplaceTemplate {
  return {
    id: 'tpl_1',
    title: 'Test',
    description: 'desc',
    shortDescription: 'short',
    author: {
      id: 'a1',
      name: 'Author',
      isVerified: false,
      profileUrl: ''
    },
    categories: [],
    tags: [],
    difficulty: 'beginner',
    requiredModels: [],
    requiredNodes: [],
    vramRequirement: 0,
    thumbnail: '',
    gallery: [],
    workflowPreview: '',
    license: 'mit',
    version: '1.0.0',
    status: 'draft',
    updatedAt: new Date().toISOString(),
    stats: {
      downloads: 0,
      favorites: 0,
      rating: 0,
      reviewCount: 0,
      weeklyTrend: 0
    },
    ...overrides
  }
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      marketplace: {
        authorDashboard: 'My Templates',
        status: {
          draft: 'Draft',
          pending_review: 'Pending Review',
          approved: 'Approved',
          rejected: 'Rejected',
          unpublished: 'Unpublished'
        },
        stats: {
          downloads: 'Downloads',
          favorites: 'Favorites',
          rating: 'Rating',
          trend: 'Trend'
        },
        period: {
          day: 'Today',
          week: 'This Week',
          month: 'This Month'
        }
      }
    }
  }
})

function createWrapper() {
  const templatesResponse: AuthorTemplatesResponse = {
    templates: [
      makeSeedTemplate({ id: 'tpl_1', title: 'Draft WF', status: 'draft' }),
      makeSeedTemplate({
        id: 'tpl_2',
        title: 'Published WF',
        status: 'approved'
      }),
      makeSeedTemplate({
        id: 'tpl_3',
        title: 'Pending WF',
        status: 'pending_review'
      })
    ]
  }
  const statsResponse: AuthorStats = {
    templatesCount: 3,
    totalDownloads: 500,
    totalFavorites: 30,
    averageRating: 4.1,
    periodDownloads: 50,
    periodFavorites: 5,
    trend: 3.2
  }

  mockService.getAuthorTemplates.mockResolvedValue(templatesResponse)
  mockService.getAuthorStats.mockResolvedValue(statsResponse)

  return mount(AuthorDashboard, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: { teleport: true }
    }
  })
}

describe('AuthorDashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders the dashboard title', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('My Templates')
  })

  it('loads templates and stats on mount', async () => {
    createWrapper()
    await vi.dynamicImportSettled()

    expect(mockService.getAuthorTemplates).toHaveBeenCalled()
    expect(mockService.getAuthorStats).toHaveBeenCalled()
  })

  it('shows templates grouped by status', async () => {
    const wrapper = createWrapper()
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Draft')
    expect(wrapper.text()).toContain('Approved')
    expect(wrapper.text()).toContain('Pending Review')
  })

  it('displays stats summary', async () => {
    const wrapper = createWrapper()
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('500')
    expect(wrapper.text()).toContain('30')
  })

  it('has period selector buttons', async () => {
    const wrapper = createWrapper()
    await vi.dynamicImportSettled()

    expect(wrapper.find('[data-testid="period-day"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="period-week"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="period-month"]').exists()).toBe(true)
  })
})
