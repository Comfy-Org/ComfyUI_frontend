import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: (key: string) => key
  }))
}))

import type {
  MarketplaceTemplate,
  TemplateRevenue
} from '@/types/templateMarketplace'

import TemplateListItem from './TemplateListItem.vue'

function makeTemplate(
  overrides?: Partial<MarketplaceTemplate>
): MarketplaceTemplate {
  return {
    id: 'tpl-1',
    title: 'Test Template',
    description: 'Full description',
    shortDescription: 'Short desc',
    author: {
      id: 'usr-1',
      name: 'Author',
      isVerified: true,
      profileUrl: '/author'
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
      downloads: 1000,
      favorites: 50,
      rating: 4.5,
      reviewCount: 10,
      weeklyTrend: 2
    },
    ...overrides
  }
}

const stubRevenue: TemplateRevenue = {
  templateId: 'tpl-1',
  totalRevenue: 10_000,
  monthlyRevenue: 1_500,
  currency: 'USD'
}

interface MountOptions {
  template?: MarketplaceTemplate
  revenue?: TemplateRevenue
  showRevenue?: boolean
  isCurrentUser?: boolean
}

function mountItem(options: MountOptions = {}) {
  return mount(TemplateListItem, {
    props: {
      template: options.template ?? makeTemplate(),
      revenue: options.revenue,
      showRevenue: options.showRevenue ?? false,
      isCurrentUser: options.isCurrentUser ?? false
    },
    global: {
      stubs: {
        StarRating: {
          template: '<span data-testid="star-rating" />',
          props: ['rating', 'size']
        },
        Button: {
          template: '<button data-testid="unpublish-button"><slot /></button>',
          props: ['variant', 'size']
        }
      }
    }
  })
}

describe('TemplateListItem', () => {
  it('renders the template title and description', () => {
    const wrapper = mountItem({
      template: makeTemplate({
        title: 'My Workflow',
        shortDescription: 'A cool workflow'
      })
    })
    expect(wrapper.text()).toContain('My Workflow')
    expect(wrapper.text()).toContain('A cool workflow')
  })

  it('renders download and favorite stats', () => {
    const wrapper = mountItem({
      template: makeTemplate({
        stats: {
          downloads: 5_000,
          favorites: 200,
          rating: 4,
          reviewCount: 15,
          weeklyTrend: 1
        }
      })
    })
    expect(wrapper.text()).toContain('5,000')
    expect(wrapper.text()).toContain('200')
  })

  it('hides revenue column when showRevenue is false', () => {
    const wrapper = mountItem({
      revenue: stubRevenue,
      showRevenue: false
    })
    expect(wrapper.find('[data-testid="revenue-column"]').exists()).toBe(false)
  })

  it('shows revenue column when showRevenue is true', () => {
    const wrapper = mountItem({
      revenue: stubRevenue,
      showRevenue: true
    })
    expect(wrapper.find('[data-testid="revenue-column"]').exists()).toBe(true)
  })

  it('hides unpublish button when isCurrentUser is false', () => {
    const wrapper = mountItem({ isCurrentUser: false })
    expect(wrapper.find('[data-testid="unpublish-button"]').exists()).toBe(
      false
    )
  })

  it('shows unpublish button when isCurrentUser is true', () => {
    const wrapper = mountItem({ isCurrentUser: true })
    expect(wrapper.find('[data-testid="unpublish-button"]').exists()).toBe(true)
  })

  it('emits unpublish event with template ID when button is clicked', async () => {
    const wrapper = mountItem({ isCurrentUser: true })
    await wrapper.find('[data-testid="unpublish-button"]').trigger('click')
    expect(wrapper.emitted('unpublish')).toEqual([['tpl-1']])
  })
})
