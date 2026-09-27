import type { CollectionEntry } from 'astro:content'

import type { CustomerStoryFrontmatter } from '../content/customers.schema'

export type CustomerStoryEntry = CollectionEntry<'customers'>

export function storySlug(id: string): string {
  const separator = id.indexOf('/')
  return separator === -1 ? id : id.slice(separator + 1)
}

export function sortStories<T extends { data: { order: number } }>(
  stories: T[]
): T[] {
  return [...stories].sort((a, b) => a.data.order - b.data.order)
}

export function nextStory<T extends { id: string }>(
  ordered: T[],
  slug: string
): T {
  const index = ordered.findIndex((story) => storySlug(story.id) === slug)
  // Fail loud on a bad slug or empty list rather than silently returning the
  // first story, which would link to the wrong "what's next" article.
  if (index === -1) {
    throw new Error(`nextStory: no story found for slug "${slug}"`)
  }
  return ordered[(index + 1) % ordered.length]
}

export interface StoryCard {
  slug: string
  title: string
  category: string
  cover: string
}

export function toCardProps(entry: {
  id: string
  data: CustomerStoryFrontmatter
}): StoryCard {
  return {
    slug: storySlug(entry.id),
    title: entry.data.title,
    category: entry.data.category,
    cover: entry.data.cover
  }
}
