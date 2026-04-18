import type { TranslationKey } from '../i18n/translations'

const DEFAULT_DETAIL_IMAGE = '/images/customers/detail-big-image.webp'

interface CustomerStory {
  slug: string
  image: string
  detailImage: string
  category: TranslationKey
  title: TranslationKey
  body: TranslationKey
  detailPrefix: string
  readMoreHref?: string
}

export const customerStories: CustomerStory[] = [
  {
    slug: 'series-entertainment',
    image: '/images/customers/story-series.webp',
    detailImage: DEFAULT_DETAIL_IMAGE,
    category: 'customers.story.series-entertainment.category',
    title: 'customers.story.series-entertainment.title',
    body: 'customers.story.series-entertainment.body',
    detailPrefix: 'customers.detail.series-entertainment'
  },
  {
    slug: 'open-story-movement',
    image: '/images/customers/story-effortless.webp',
    detailImage: DEFAULT_DETAIL_IMAGE,
    category: 'customers.story.open-story-movement.category',
    title: 'customers.story.open-story-movement.title',
    body: 'customers.story.open-story-movement.body',
    detailPrefix: 'customers.detail.open-story-movement'
  },
  {
    slug: 'moment-factory',
    image: '/images/customers/story-moment.webp',
    detailImage: DEFAULT_DETAIL_IMAGE,
    category: 'customers.story.moment-factory.category',
    title: 'customers.story.moment-factory.title',
    body: 'customers.story.moment-factory.body',
    detailPrefix: 'customers.detail.moment-factory'
  },
  {
    slug: 'ubisoft-chord',
    image: '/images/customers/story-ubisoft.webp',
    detailImage: DEFAULT_DETAIL_IMAGE,
    category: 'customers.story.ubisoft-chord.category',
    title: 'customers.story.ubisoft-chord.title',
    body: 'customers.story.ubisoft-chord.body',
    detailPrefix: 'customers.detail.ubisoft-chord'
  }
]

export function getStoryBySlug(slug: string): CustomerStory | undefined {
  return customerStories.find((s) => s.slug === slug)
}

export function getNextStory(slug: string): CustomerStory {
  const index = customerStories.findIndex((s) => s.slug === slug)
  return customerStories[(index + 1) % customerStories.length]
}
