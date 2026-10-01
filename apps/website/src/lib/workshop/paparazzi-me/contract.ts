import type { PaparazziSetup, Resolution, SceneId } from './setup'
import { isCustomScene } from './setup'

/**
 * What the Paparazzi me backend receives for one run. The face is the
 * visitor's photo; the star is only a name, looked up server side.
 */
export interface PaparazziRequest {
  readonly faceUrl: string
  readonly celebrity: string
  /** The preset picked, or `custom` when the visitor wrote their own. */
  readonly scene: SceneId | 'custom'
  /** The scene in words: the preset's description or the visitor's text. */
  readonly sceneDescription: string
  readonly resolution: Resolution
  readonly seed: number
}

export interface PaparazziResult {
  readonly url: string
  readonly seed: number
}

const SCENE_DESCRIPTIONS = {
  'red-carpet':
    'on the red carpet at a film premiere, a step-and-repeat wall and velvet ropes behind',
  'street-night':
    'on a city street at night, leaving a restaurant, wet pavement and street lamps',
  cafe: 'at a pavement café table in the afternoon, cups and a window behind',
  airport:
    'walking through an airport terminal with luggage, big windows behind'
} as const satisfies Record<SceneId, string>

function sceneDescription(setup: PaparazziSetup): string {
  return isCustomScene(setup)
    ? setup.sceneOverride.trim()
    : SCENE_DESCRIPTIONS[setup.scene]
}

/** The request for a face photo and a setup. */
export function paparazziRequest(
  faceUrl: string,
  setup: PaparazziSetup
): PaparazziRequest {
  return {
    faceUrl,
    celebrity: setup.celebrity.trim(),
    scene: isCustomScene(setup) ? 'custom' : setup.scene,
    sceneDescription: sceneDescription(setup),
    resolution: setup.resolution,
    seed: setup.seed
  }
}
