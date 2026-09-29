import { modelAliasUrls, modelPageUrls } from './model-urls'

export const HUB_MODELS_PATH = '/hub/models'

export const hubModelPath = (newSlug: string) =>
  `${HUB_MODELS_PATH}/${newSlug}/`

/** Old `provider--model--task` page id → its `/hub/models/` slug. */
export const hubModelSlugs: ReadonlyMap<string, string> = new Map(
  modelPageUrls.map(({ oldSlug, newSlug }) => [oldSlug, newSlug])
)

/** Old alias slug → the `/hub/models/` slug it redirects to. */
export const hubModelAliases: ReadonlyMap<string, string> = new Map(
  modelAliasUrls.map(({ alias, newSlug }) => [alias, newSlug])
)

/** Disabled models have no row; their pages are never built. */
export const hubModelHref = (oldSlug: string) =>
  hubModelPath(
    hubModelSlugs.get(oldSlug) ?? hubModelAliases.get(oldSlug) ?? oldSlug
  )

const oldModelPaths = new Set([
  '/models',
  ...[...hubModelSlugs.keys(), ...hubModelAliases.keys()].map(
    (slug) => `/models/${slug}`
  )
])

/**
 * Links that still point at an old, redirecting model address, in built HTML
 * (`href="…"`), page data JSON (`"href":"…"`) or a markdown twin (`](…)`).
 */
export function oldModelLinks(content: string): string[] {
  return Array.from(
    content.matchAll(
      /(?:href="|"href":\s*"|\]\()(?:https:\/\/comfy\.org)?(\/models(?:\/[^"?#)\s]*)?)["?#)]/g
    ),
    ([, path]) => path.replace(/\/$/, '')
  ).filter((path) => oldModelPaths.has(path))
}
