import type { UseCase } from '@/config/models-catalogue'
import { OTHER_FORMAT_USE_CASES } from '@/config/workshop-sections'
import type { Shelf } from './shelf-memory'

/**
 * The use cases a shelf stands for. Opening one is the same act as ticking it
 * in the filter, so a shelf is only ever a selection; "other formats" is the
 * three it gathers.
 */
export function openedUseCases(shelf: Shelf): UseCase[] {
  if (shelf === 'all') return []
  return shelf === 'other' ? [...OTHER_FORMAT_USE_CASES] : [shelf]
}

/** The shelf a selection reads as, for the way back from a model to it. */
export function shelfOf(selected: readonly UseCase[]): Shelf {
  if (selected.length === 1) return selected[0]
  const chosen = new Set(selected)
  return chosen.size === OTHER_FORMAT_USE_CASES.length &&
    OTHER_FORMAT_USE_CASES.every((useCase) => chosen.has(useCase))
    ? 'other'
    : 'all'
}
