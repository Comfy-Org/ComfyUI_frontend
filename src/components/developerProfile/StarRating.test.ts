import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: (key: string) => key
  }))
}))

import StarRating from './StarRating.vue'

function mountRating(rating: number, size?: 'sm' | 'md') {
  return mount(StarRating, {
    props: { rating, size }
  })
}

describe('StarRating', () => {
  it('renders five star containers', () => {
    const wrapper = mountRating(3)
    const starContainers = wrapper.findAll('[role="img"] > div')
    expect(starContainers).toHaveLength(5)
  })

  it('fills all stars for a rating of 5', () => {
    const wrapper = mountRating(5)
    const fills = wrapper.findAll('[role="img"] > div > div')
    expect(fills).toHaveLength(5)
    for (const fill of fills) {
      expect(fill.attributes('style')).toContain('width: 100%')
    }
  })

  it('fills no stars for a rating of 0', () => {
    const wrapper = mountRating(0)
    const fills = wrapper.findAll('[role="img"] > div > div')
    expect(fills).toHaveLength(0)
  })

  it('renders correct fills for a half-star rating of 3.5', () => {
    const wrapper = mountRating(3.5)
    const fills = wrapper.findAll('[role="img"] > div > div')
    expect(fills).toHaveLength(4)

    expect(fills[0].attributes('style')).toContain('width: 100%')
    expect(fills[1].attributes('style')).toContain('width: 100%')
    expect(fills[2].attributes('style')).toContain('width: 100%')
    expect(fills[3].attributes('style')).toContain('width: 50%')
  })

  it('renders correct fills for a half-star rating of 2.5', () => {
    const wrapper = mountRating(2.5)
    const fills = wrapper.findAll('[role="img"] > div > div')
    expect(fills).toHaveLength(3)

    expect(fills[0].attributes('style')).toContain('width: 100%')
    expect(fills[1].attributes('style')).toContain('width: 100%')
    expect(fills[2].attributes('style')).toContain('width: 50%')
  })

  it('uses smaller size class when size is sm', () => {
    const wrapper = mountRating(3, 'sm')
    const html = wrapper.html()
    expect(html).toContain('size-3.5')
  })

  it('uses default size class when size is md', () => {
    const wrapper = mountRating(3, 'md')
    const html = wrapper.html()
    expect(html).toContain('size-4')
  })
})
