import type { WorkshopModel } from '@/config/models-catalogue'
import type { WorkshopAppId } from './apps'

interface AppParts {
  /** Whether the app runs the image and video models its studio offers. */
  readonly studioModels: boolean
  /** Hub workflows built on the same model the app runs. */
  readonly workflows: readonly string[]
}

const APP_PARTS: Readonly<Record<WorkshopAppId, AppParts>> = {
  studio: { studioModels: true, workflows: [] },
  reshoot: {
    studioModels: false,
    workflows: ['workflows/video-from-references']
  }
}

/** The Hub pages behind an app: its models first, then its workflows. */
export function appBuiltWith(
  app: WorkshopAppId,
  studioModels: readonly string[],
  pages: readonly WorkshopModel[]
): WorkshopModel[] {
  const parts = APP_PARTS[app]
  const slugs = [
    ...(parts.studioModels ? studioModels : []),
    ...parts.workflows
  ]
  const bySlug = new Map(pages.map((page) => [page.slug, page]))
  const seen = new Set<string>()
  return slugs.flatMap((slug) => {
    const page = bySlug.get(slug)
    if (!page?.href || seen.has(page.href)) return []
    seen.add(page.href)
    return [page]
  })
}
