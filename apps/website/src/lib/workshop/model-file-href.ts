import { getRoutes } from '@/config/routes'

const MODEL_FILES_PATH = '/hub/models/local/'

/**
 * Where a model file page (a VAE, a text encoder, a checkpoint…) lives. With
 * the Hub in the build it sits under the Hub's models; without it, the page
 * keeps its supported-models address.
 */
export function modelFileHref(slug: string, workshopInBuild: boolean): string {
  return `${workshopInBuild ? MODEL_FILES_PATH : getRoutes().models}${slug}/`
}
