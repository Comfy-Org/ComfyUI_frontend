import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'

import type { Locale } from '../i18n/translations'

export type GalleryEntry = CollectionEntry<'gallery'>
export type EventsEntry = CollectionEntry<'events'>
export type TutorialsEntry = CollectionEntry<'tutorials'>

export function slugOf(entry: { id: string }): string {
  const slash = entry.id.indexOf('/')
  return slash === -1 ? entry.id : entry.id.slice(slash + 1)
}

export async function getVisibleGalleryByLocale(
  locale: Locale
): Promise<GalleryEntry[]> {
  const prefix = `${locale}/`
  const entries: GalleryEntry[] = await getCollection('gallery')
  return entries
    .filter(
      (entry) => entry.id.startsWith(prefix) && entry.data.visible !== false
    )
    .sort((a, b) => a.data.order - b.data.order)
}

export async function getGalleryByIds(
  slugs: readonly string[],
  locale: Locale
): Promise<GalleryEntry[]> {
  const entries: GalleryEntry[] = await getCollection('gallery')
  const bySlug = new Map<string, GalleryEntry>()
  for (const entry of entries) {
    if (entry.id.startsWith(`${locale}/`)) {
      bySlug.set(slugOf(entry), entry)
    }
  }
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((entry): entry is GalleryEntry => entry !== undefined)
}

export async function getEventsByLocale(
  locale: Locale
): Promise<EventsEntry[]> {
  const prefix = `${locale}/`
  const entries: EventsEntry[] = await getCollection('events')
  return entries
    .filter((entry) => entry.id.startsWith(prefix))
    .sort((a, b) => a.data.order - b.data.order)
}

export async function getTutorialsByLocale(
  locale: Locale
): Promise<TutorialsEntry[]> {
  const prefix = `${locale}/`
  const entries: TutorialsEntry[] = await getCollection('tutorials')
  return entries
    .filter((entry) => entry.id.startsWith(prefix))
    .sort((a, b) => a.data.order - b.data.order)
}
