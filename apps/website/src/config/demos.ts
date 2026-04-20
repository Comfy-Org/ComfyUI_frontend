import type { TranslationKey } from '../i18n/translations'

interface Demo {
  readonly slug: string
  readonly arcadeId: string
  readonly category: TranslationKey
  readonly title: TranslationKey
  readonly description: TranslationKey
  readonly ogImage: string
  readonly thumbnail: string
  readonly estimatedTime: TranslationKey
  readonly durationIso: string
  readonly difficulty: 'beginner' | 'intermediate' | 'advanced'
  readonly tags: readonly string[]
  readonly transcript?: TranslationKey
  readonly publishedDate: string
  readonly modifiedDate: string
}

export const demos: readonly Demo[] = [
  {
    slug: 'image-to-video',
    arcadeId: 'F3CTalnGnR4R0qJIVMNX',
    category: 'demos.category.templates',
    title: 'demos.image-to-video.title',
    description: 'demos.image-to-video.description',
    transcript: 'demos.image-to-video.transcript',
    ogImage: '/images/demos/image-to-video-og.png',
    thumbnail: '/images/demos/image-to-video-thumb.webp',
    estimatedTime: 'demos.duration.2min',
    durationIso: 'PT2M',
    difficulty: 'beginner',
    tags: ['templates', 'image', 'video'],
    publishedDate: '2026-04-19',
    modifiedDate: '2026-04-19'
  },
  {
    slug: 'workflow-templates',
    arcadeId: 'KhqcXDElnFWklo7ACBqE',
    category: 'demos.category.gettingStarted',
    title: 'demos.workflow-templates.title',
    description: 'demos.workflow-templates.description',
    transcript: 'demos.workflow-templates.transcript',
    ogImage: '/images/demos/workflow-templates-og.png',
    thumbnail: '/images/demos/workflow-templates-thumb.webp',
    estimatedTime: 'demos.duration.2min',
    durationIso: 'PT2M',
    difficulty: 'beginner',
    tags: ['getting-started', 'templates', 'workflow'],
    publishedDate: '2026-04-19',
    modifiedDate: '2026-04-19'
  }
]

export function getDemoBySlug(slug: string): Demo | undefined {
  return demos.find((demo) => demo.slug === slug)
}

export function getNextDemo(slug: string): Demo {
  const index = demos.findIndex((demo) => demo.slug === slug)
  if (index === -1) {
    throw new Error(`Unknown demo slug: ${slug}`)
  }
  return demos[(index + 1) % demos.length]
}
