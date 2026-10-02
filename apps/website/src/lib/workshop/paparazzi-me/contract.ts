import type { ScenePlace } from './scenes'
import type { PaparazziSetup, Resolution } from './setup'

/**
 * One looked-up paparazzi photo of the star. The backend's
 * `GET /api/paparazzi/search?q=` answers `{ provider, candidates }`, each
 * candidate a `token` and a `title`, its picture served by
 * `/api/paparazzi/scene?token=`. The mock names the place instead.
 */
export interface SceneCandidate {
  readonly token: string
  readonly place: ScenePlace
}

export interface PaparazziSearch {
  /** Who the photos come from, shown as "from <provider>". */
  readonly provider: string
  readonly candidates: readonly SceneCandidate[]
}

/**
 * The multipart fields of `POST /api/run/paparazzi-me`, one for one. The
 * images are URLs here; the real call sends their files under the same keys.
 */
export interface PaparazziRequest {
  /** "Your face". */
  readonly user: string
  readonly celebrity: string
  /** The candidate picked, sent only when no scene was uploaded. */
  readonly sceneToken?: string
  /** "Scene override": the visitor's own scene, which beats the look-up. */
  readonly scene?: string
  readonly resolution: Resolution
  readonly seed: number
}

export interface PaparazziResult {
  readonly url: string
  readonly seed: number
}

/** The request for a face, a setup and the scene it points at. */
export function paparazziRequest(
  user: string,
  setup: PaparazziSetup,
  scene: { readonly token: string } | { readonly upload: string } | undefined
): PaparazziRequest {
  return {
    user,
    celebrity: setup.celebrity.trim(),
    ...(scene && 'upload' in scene
      ? { scene: scene.upload }
      : scene && { sceneToken: scene.token }),
    resolution: setup.resolution,
    seed: setup.seed
  }
}
