import type { WorkshopModel } from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'

export const MODEL_ACCESS = ['run', 'api', 'download'] as const
export type ModelAccess = (typeof MODEL_ACCESS)[number]

export const HOSTED_ACCESS: readonly ModelAccess[] = ['run', 'api']
export const OPEN_WEIGHT_ACCESS: readonly ModelAccess[] = ['download']

export function accessFor(model: WorkshopModel): readonly ModelAccess[] {
  return model.routerId === undefined ? [] : HOSTED_ACCESS
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
