import { modelAliasUrls, modelPageUrls } from './model-urls'

export const HUB_MODELS_PATH = '/hub/models'

const hubModelPath = (newSlug: string) => `${HUB_MODELS_PATH}/${newSlug}/`

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
  hubModelPath(hubModelSlugs.get(oldSlug) ?? oldSlug)
