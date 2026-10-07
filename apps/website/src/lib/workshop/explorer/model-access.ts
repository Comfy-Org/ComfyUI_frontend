import type {
  WorkshopModel,
  WorkshopModelDetail
} from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'

export const MODEL_ACCESS = ['run', 'api', 'download'] as const
export type ModelAccess = (typeof MODEL_ACCESS)[number]

const HOSTED_ACCESS: readonly ModelAccess[] = ['run', 'api']
const API_ACCESS: readonly ModelAccess[] = ['api']
export const OPEN_WEIGHT_ACCESS: readonly ModelAccess[] = ['download']

/**
 * Whether a visitor can run this model from its Hub page. The Run button, the
 * playground, a card's Run tag and the Run here filter all ask this, so none
 * of them promises a run the page cannot start. A catalogue entry carries no
 * Router contract, so only a model's detail can rule its contract out.
 */
export function runsHere(model: WorkshopModel | WorkshopModelDetail): boolean {
  if (model.routerId === undefined || model.incompleteReason) return false
  if (import.meta.env.PUBLIC_WORKSHOP_ROUTER_RUN !== '1') return false
  return !('examples' in model) || !!model.execution
}

export function accessFor(model: WorkshopModel): readonly ModelAccess[] {
  if (model.routerId === undefined || model.incompleteReason) return []
  return runsHere(model) ? HOSTED_ACCESS : API_ACCESS
}

/** The catalogue's how-you-use-it filter, kept in the address as `?use=`. */
export const ACCESS_PARAM = 'use'

export function parseAccess(search: string): ModelAccess[] {
  const wanted = new URLSearchParams(search).get(ACCESS_PARAM)?.split(',')
  return MODEL_ACCESS.filter((value) => wanted?.includes(value))
}

export function offersAccess(
  access: readonly ModelAccess[],
  wanted: readonly ModelAccess[]
): boolean {
  return wanted.length === 0 || wanted.some((value) => access.includes(value))
}

export const accessBadgeKey: Record<ModelAccess, TranslationKey> = {
  run: 'workshop.explorer.badge.run',
  api: 'workshop.explorer.badge.api',
  download: 'workshop.explorer.badge.download'
}

export const accessFilterKey: Record<ModelAccess, TranslationKey> = {
  run: 'workshop.explorer.filter.run',
  api: 'workshop.explorer.filter.api',
  download: 'workshop.explorer.filter.download'
}
