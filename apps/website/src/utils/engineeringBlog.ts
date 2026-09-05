import type { CollectionEntry } from 'astro:content'

export type EngineeringBlogPostEntry = CollectionEntry<'engineeringBlog'>

// Entries are stored as `en/<slug>.mdx`; the id's locale prefix isn't part of
// the public URL (see src/content/README.md for why customers keeps a locale
// folder even for a single-locale collection).
export function postSlug(id: string): string {
  const separator = id.indexOf('/')
  return separator === -1 ? id : id.slice(separator + 1)
}

export function sortPostsByDateDesc<T extends { data: { date: Date } }>(
  posts: T[]
): T[] {
  return [...posts].sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime()
  )
}

export interface EngineeringPostCard {
  slug: string
  title: string
  description: string
  author: string
  date: Date
  heroDiagram: EngineeringBlogPostEntry['data']['heroDiagram']
}

export function toCardProps(
  entry: Pick<EngineeringBlogPostEntry, 'id' | 'data'>
): EngineeringPostCard {
  return {
    slug: postSlug(entry.id),
    title: entry.data.title,
    description: entry.data.description,
    author: entry.data.author,
    date: entry.data.date,
    heroDiagram: entry.data.heroDiagram
  }
}
