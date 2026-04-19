import type { TranslationKey } from '../i18n/translations'

interface CustomerStory {
  slug: string
  image: string
  category: TranslationKey
  title: TranslationKey
  body: TranslationKey
  detailPrefix: string
  readMoreHref?: string
}

export const customerStories: CustomerStory[] = [
  {
    slug: 'series-entertainment',
    image:
      'https://media.comfy.org/website/customers/series-entertainment/cover.webp',
    category: 'customers.story.series-entertainment.category',
    title: 'customers.story.series-entertainment.title',
    body: 'customers.story.series-entertainment.body',
    detailPrefix: 'customers.detail.series-entertainment',
    readMoreHref:
      'https://comfy.org/cloud/enterprise-case-studies/how-series-entertainment-rebuilt-game-and-video-production-with-comfyui'
  },
  {
    slug: 'open-story-movement',
    image:
      'https://media.comfy.org/website/customers/open-story-movement/cover.webp',
    category: 'customers.story.open-story-movement.category',
    title: 'customers.story.open-story-movement.title',
    body: 'customers.story.open-story-movement.body',
    detailPrefix: 'customers.detail.open-story-movement',
    readMoreHref: 'https://blog.comfy.org/p/how-open-source-is-fueling-the-open'
  },
  {
    slug: 'moment-factory',
    image:
      'https://media.comfy.org/website/customers/moment-factory/cover.webp',
    category: 'customers.story.moment-factory.category',
    title: 'customers.story.moment-factory.title',
    body: 'customers.story.moment-factory.body',
    detailPrefix: 'customers.detail.moment-factory',
    readMoreHref:
      'https://comfy.org/cloud/enterprise-case-studies/comfyui-at-architectural-scale-how-moment-factory-reimagined-3d-projection-mapping'
  },
  {
    slug: 'ubisoft-chord',
    image: 'https://media.comfy.org/website/customers/ubisoft/cover.webp',
    category: 'customers.story.ubisoft-chord.category',
    title: 'customers.story.ubisoft-chord.title',
    body: 'customers.story.ubisoft-chord.body',
    detailPrefix: 'customers.detail.ubisoft-chord',
    readMoreHref:
      'https://blog.comfy.org/p/ubisoft-open-sources-the-chord-model'
  }
]

export function getStoryBySlug(slug: string): CustomerStory | undefined {
  return customerStories.find((s) => s.slug === slug)
}

export function getNextStory(slug: string): CustomerStory {
  const index = customerStories.findIndex((s) => s.slug === slug)
  return customerStories[(index + 1) % customerStories.length]
}
