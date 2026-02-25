import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: (key: string) => key
  }))
}))

import type { TemplateReview } from '@/types/templateMarketplace'

import ReviewCard from './ReviewCard.vue'

function makeReview(overrides?: Partial<TemplateReview>): TemplateReview {
  return {
    id: 'rev-1',
    authorName: 'TestUser',
    authorAvatarUrl: undefined,
    rating: 4,
    text: 'Great template!',
    createdAt: new Date('2025-10-15'),
    templateId: 'tpl-1',
    ...overrides
  }
}

function mountCard(review: TemplateReview) {
  return mount(ReviewCard, {
    props: { review },
    global: {
      stubs: {
        StarRating: {
          template: '<span data-testid="star-rating" :data-rating="rating" />',
          props: ['rating', 'size']
        }
      }
    }
  })
}

describe('ReviewCard', () => {
  it('renders the author name', () => {
    const wrapper = mountCard(makeReview({ authorName: 'PixelWizard' }))
    expect(wrapper.text()).toContain('PixelWizard')
  })

  it('renders the review text', () => {
    const wrapper = mountCard(makeReview({ text: 'Awesome workflow!' }))
    expect(wrapper.text()).toContain('Awesome workflow!')
  })

  it('passes the rating to StarRating', () => {
    const wrapper = mountCard(makeReview({ rating: 3.5 }))
    const starRating = wrapper.find('[data-testid="star-rating"]')
    expect(starRating.exists()).toBe(true)
    expect(starRating.attributes('data-rating')).toBe('3.5')
  })

  it('renders a formatted date', () => {
    const wrapper = mountCard(makeReview({ createdAt: new Date('2025-10-15') }))
    expect(wrapper.text()).toContain('2025')
  })
})
