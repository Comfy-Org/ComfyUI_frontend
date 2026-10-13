import type { UseCase } from '@/config/models-catalogue'
import {
  USE_CASES,
  WORKFLOW_CATEGORY_USE_CASE
} from '@/config/models-catalogue'
import { openedUseCases } from './shelf-use-cases'

export const USE_CASE_PARAM = 'useCase'

/** The Workflows catalogue's retired category parameter. */
export const CATEGORY_PARAM = 'category'

const LEGACY_TAB_USE_CASE: Readonly<Record<string, UseCase | undefined>> = {
  upscale: 'upscale'
}

/**
 * The use cases an address names, as `?useCase=edit-images,edit-videos`. A
 * single shelf name, including "other", opens what that shelf stands for, and
 * a retired `?category=` or `?tab=upscale` opens the use case it became.
 */
export function parseUseCases(search: string): UseCase[] {
  const params = new URLSearchParams(search)
  const named = params.get(USE_CASE_PARAM)?.split(',') ?? []
  const opened = named.flatMap((value) =>
    value === 'other'
      ? openedUseCases('other')
      : USE_CASES.filter((useCase) => useCase === value)
  )
  const retired = [
    LEGACY_TAB_USE_CASE[params.get('tab') ?? ''],
    ...params
      .getAll(CATEGORY_PARAM)
      .map((category) => WORKFLOW_CATEGORY_USE_CASE[category])
  ].filter((useCase): useCase is UseCase => useCase !== undefined)
  return [...new Set([...opened, ...retired])]
}
