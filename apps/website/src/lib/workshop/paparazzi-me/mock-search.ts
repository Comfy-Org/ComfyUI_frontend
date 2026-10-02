import { mockJob } from '../mock-job'
import type { PaparazziSearch } from './contract'
import type { ScenePlace } from './scenes'
import { SCENE_PLACES } from './scenes'

const PROVIDER = 'Comfy sample library'
const SEARCH_DELAY_MS = 700

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}

/** What the look-up finds for `celebrity`: the sample photos, every time. */
export function lookUp(celebrity: string): PaparazziSearch {
  return {
    provider: PROVIDER,
    candidates: SCENE_PLACES.map((place) => ({
      token: `${slug(celebrity)}/${place.id}`,
      place
    }))
  }
}

/** The place a candidate's token points at. */
export function placeOfToken(token: string): ScenePlace | undefined {
  const id = token.slice(token.lastIndexOf('/') + 1)
  return SCENE_PLACES.find((place) => place.id === id)
}

/**
 * Stands in for `GET /api/paparazzi/search?q=` until it exists: waits a
 * moment, then answers `lookUp`.
 */
export function searchScenes(
  celebrity: string,
  signal: AbortSignal
): Promise<PaparazziSearch> {
  return mockJob(lookUp(celebrity), signal, SEARCH_DELAY_MS)
}
