import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type {
  AuthorStats,
  AuthorTemplatesResponse,
  MarketplaceTemplate
} from '@/platform/marketplace/apiTypes'
import { OnCloseKey } from '@/types/widgetTypes'

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

const mockPublishDialog = vi.hoisted(() => ({
  show: vi.fn()
}))

vi.mock('@/platform/marketplace/services/marketplaceService', () => ({
  marketplaceService: mockService
}))

vi.mock('@/platform/marketplace/composables/usePublishDialog', () => ({
  usePublishDialog: () => mockPublishDialog
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
      g: {
        closeDialog: 'Close',
        showLeftPanel: 'Show left panel',
        hideLeftPanel: 'Hide left panel',
        showRightPanel: 'Show right panel',
        hideRightPanel: 'Hide right panel'
      },
      marketplace: {
        authorDashboard: 'My Templates',
        edit: 'Edit',
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

function createWrapper(
  templates: AuthorTemplatesResponse['templates'] = [
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
    }),
    makeSeedTemplate({
      id: 'tpl_4',
      title: 'Rejected WF',
      status: 'rejected'
    }),
    makeSeedTemplate({
      id: 'tpl_5',
      title: 'Unpublished WF',
      status: 'unpublished'
    })
  ]
) {
  const templatesResponse: AuthorTemplatesResponse = {
    templates
  }
  const statsResponse: AuthorStats = {
    templatesCount: templates.length,
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
      provide: { [OnCloseKey as symbol]: () => {} },
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

  describe('Edit button', () => {
    it('shows Edit button for draft templates', async () => {
      const wrapper = createWrapper()
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      expect(
        wrapper.find('[data-testid="btn-edit-template-tpl_1"]').exists()
      ).toBe(true)
    })

    it('shows Edit button for pending_review templates', async () => {
      const wrapper = createWrapper()
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      expect(
        wrapper.find('[data-testid="btn-edit-template-tpl_3"]').exists()
      ).toBe(true)
    })

    it('does not show Edit button for approved templates', async () => {
      const wrapper = createWrapper()
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      expect(
        wrapper.find('[data-testid="btn-edit-template-tpl_2"]').exists()
      ).toBe(false)
    })

    it('shows Edit button for rejected templates', async () => {
      const wrapper = createWrapper()
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      expect(
        wrapper.find('[data-testid="btn-edit-template-tpl_4"]').exists()
      ).toBe(true)
    })

    it('does not show Edit button for unpublished templates', async () => {
      const wrapper = createWrapper()
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      expect(
        wrapper.find('[data-testid="btn-edit-template-tpl_5"]').exists()
      ).toBe(false)
    })

    it('calls usePublishDialog.show with initialTemplate when Edit clicked on draft', async () => {
      const draftTemplate = makeSeedTemplate({
        id: 'tpl_draft',
        title: 'Draft WF',
        status: 'draft'
      })
      const wrapper = createWrapper([
        draftTemplate,
        makeSeedTemplate({ id: 'tpl_2', status: 'approved' })
      ])
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      await wrapper
        .find('[data-testid="btn-edit-template-tpl_draft"]')
        .trigger('click')

      expect(mockPublishDialog.show).toHaveBeenCalledWith({
        initialTemplate: draftTemplate,
        onClose: expect.any(Function)
      })
    })

    it('calls usePublishDialog.show with initialTemplate when Edit clicked on pending_review', async () => {
      const pendingTemplate = makeSeedTemplate({
        id: 'tpl_pending',
        title: 'Pending WF',
        status: 'pending_review'
      })
      const wrapper = createWrapper([
        makeSeedTemplate({ id: 'tpl_1', status: 'draft' }),
        pendingTemplate
      ])
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      await wrapper
        .find('[data-testid="btn-edit-template-tpl_pending"]')
        .trigger('click')

      expect(mockPublishDialog.show).toHaveBeenCalledWith({
        initialTemplate: pendingTemplate,
        onClose: expect.any(Function)
      })
    })

    it('refreshes templates when publish wizard closes', async () => {
      const draftTemplate = makeSeedTemplate({
        id: 'tpl_draft',
        title: 'Draft WF',
        status: 'draft'
      })
      const wrapper = createWrapper([draftTemplate])
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      await wrapper
        .find('[data-testid="btn-edit-template-tpl_draft"]')
        .trigger('click')

      const onClose = mockPublishDialog.show.mock.calls[0][0].onClose
      onClose()

      expect(mockService.getAuthorTemplates).toHaveBeenCalledTimes(2)
    })
  })
})
