import hubAppNames from './hub-app-names.json' with { type: 'json' }
import hubWorkflowNames from './hub-workflow-names.json' with { type: 'json' }
import { modelAliasUrls, modelPageUrls } from './model-urls'

export const HUB_MODELS_PATH = '/hub/models'
export const HUB_WORKFLOWS_PATH = '/hub/workflows'
export const HUB_APPS_PATH = '/hub/apps'
const WORKFLOW_SLUG_PREFIX = 'workflows/'
const APP_SLUG_PREFIX = 'apps/'

/** A workflow page id (`workflows/<name>`) → its name under /hub/workflows. */
export const hubWorkflowName = (slug: string) =>
  slug.startsWith(WORKFLOW_SLUG_PREFIX)
    ? slug.slice(WORKFLOW_SLUG_PREFIX.length)
    : slug

export const hubWorkflowHref = (slug: string) =>
  `${HUB_WORKFLOWS_PATH}/${hubWorkflowName(slug)}/`

/** An app page id (`apps/<name>`) → its name under /hub/apps. */
export const hubAppName = (slug: string) =>
  slug.startsWith(APP_SLUG_PREFIX) ? slug.slice(APP_SLUG_PREFIX.length) : slug

export const hubAppHref = (slug: string) =>
  `${HUB_APPS_PATH}/${hubAppName(slug)}/`

/** Every app page the site builds, as `apps/<name>` page ids. */
export const hubAppSlugs: readonly string[] = hubAppNames.map(
  (name) => `${APP_SLUG_PREFIX}${name}`
)

/** Every workflow page the site builds, as `workflows/<name>` page ids. */
export const hubWorkflowSlugs: readonly string[] = hubWorkflowNames.map(
  (name) => `${WORKFLOW_SLUG_PREFIX}${name}`
)

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

/** Throws for a slug with no built page, such as a disabled model. */
export function hubModelHref(oldSlug: string): string {
  const newSlug = hubModelSlugs.get(oldSlug) ?? hubModelAliases.get(oldSlug)
  if (!newSlug) throw new Error(`No /hub/models page for ${oldSlug}`)
  return hubModelPath(newSlug)
}

const oldModelPaths = new Set([
  '/models',
  ...[
    ...hubModelSlugs.keys(),
    ...hubModelAliases.keys(),
    ...hubWorkflowSlugs,
    ...hubAppSlugs
  ].map((slug) => `/models/${slug}`)
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
