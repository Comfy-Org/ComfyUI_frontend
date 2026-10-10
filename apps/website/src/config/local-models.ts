import { HUB_MODELS_PATH } from './hub-models'
import type { Model } from './models'
import { models } from './models'

export const LOCAL_MODELS_PATH = `${HUB_MODELS_PATH}/local`

export const localModelPath = (slug: string) => `${LOCAL_MODELS_PATH}/${slug}/`

export const localModelTwinPath = (slug: string) =>
  `${LOCAL_MODELS_PATH}/${slug}.md`

const isLocalFile = (model: Model) => model.directory !== 'partner_nodes'

/** Downloadable model files, one page each under /hub/models/local. */
export const localModels: readonly Model[] = models.filter(
  (model) => isLocalFile(model) && !model.canonicalSlug
)

/** Quantization variants whose page is another file's page. */
export const localModelAliases: readonly Model[] = models.filter(
  (model) => isLocalFile(model) && model.canonicalSlug !== undefined
)
