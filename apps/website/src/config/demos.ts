import type { TranslationKey } from '../i18n/translations'

export interface Demo {
  slug: string
  arcadeId: string
  category: TranslationKey
  title: TranslationKey
  description: TranslationKey
  ogImage: string
  thumbnail: string
  estimatedTime: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  transcript?: TranslationKey
  publishedDate: string
  modifiedDate: string
}

export const demos: Demo[] = [
  {
    slug: 'image-to-video',
    arcadeId: 'F3CTalnGnR4R0qJIVMNX',
    category: 'demos.category.templates',
    title: 'demos.image-to-video.title',
    description: 'demos.image-to-video.description',
    transcript: 'demos.image-to-video.transcript',
    ogImage: '/images/demos/image-to-video-og.png',
    thumbnail: '/images/demos/image-to-video-thumb.webp',
    estimatedTime: '~2 min',
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
    estimatedTime: '~2 min',
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
  return demos[(index + 1) % demos.length]
}

export function getDemosByTag(tag: string): Demo[] {
  return demos.filter((demo) => demo.tags.includes(tag))
}
