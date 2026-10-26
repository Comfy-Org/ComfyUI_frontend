import type { UseCase } from '@/config/models-catalogue'
import { USE_CASES } from '@/config/models-catalogue'
import { openedUseCases } from './shelf-use-cases'

export const USE_CASE_PARAM = 'useCase'

/**
 * The use cases an address names, as `?useCase=edit-images,edit-videos`. A
 * single shelf name, including "other", opens what that shelf stands for.
 */
export function parseUseCases(search: string): UseCase[] {
  const named = new URLSearchParams(search).get(USE_CASE_PARAM)?.split(',')
  const opened = (named ?? []).flatMap((value) =>
    value === 'other'
      ? openedUseCases('other')
      : USE_CASES.filter((useCase) => useCase === value)
  )
  return [...new Set(opened)]
}
