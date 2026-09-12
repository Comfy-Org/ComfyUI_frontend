import type { UseCase } from '../../config/models-catalogue'
import { USE_CASES } from '../../config/models-catalogue'

export type Shelf = UseCase | 'all' | 'other'

const KEY = 'comfy-models-shelf'

// The catalogue navigates with the client router, which leaves no referrer, so
// the shelf a visitor is standing on is remembered for the page they open from
// it. It lives in session storage: their tab, their journey, gone when it ends.
export function rememberShelf(shelf: Shelf): void {
  try {
    sessionStorage.setItem(KEY, shelf)
  } catch {
    // A browser that refuses storage still browses; it just starts each page
    // from the whole catalogue.
  }
}

export function lastShelf(): Shelf | undefined {
  try {
    return asShelf(sessionStorage.getItem(KEY))
  } catch {
    return undefined
  }
}

function asShelf(value: string | null): Shelf | undefined {
  if (value === 'all' || value === 'other') return value
  return USE_CASES.find((useCase) => useCase === value)
}
