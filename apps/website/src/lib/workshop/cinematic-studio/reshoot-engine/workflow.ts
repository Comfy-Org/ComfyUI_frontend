import type {
  CameraKey,
  ReshootAspect,
  ReshootCamera,
  ReshootMotion,
  ReshootSize
} from '../reshoot'
import analyzeGraph from './analyze.api.json'
import type { Keyframe, Vec3 } from './camera'
import generateGraph from './generate.api.json'

type Graph = Record<
  string,
  { class_type: string; inputs: Record<string, unknown> }
>

/** The node caps this at what the clip holds, so the whole clip is used. */
const MAX_SECONDS = 15

const MEGAPIXELS: Record<ReshootSize, number> = { '480p': 0.4, '768p': 1 }

export interface ReshootClip {
  /** The uploaded video's asset name, as the upload returned it. */
  readonly video: string
  readonly aspect: ReshootAspect
  readonly size: ReshootSize
}

export interface ReshootShot {
  readonly clip: ReshootClip
  readonly camera: Readonly<ReshootCamera>
  readonly keepAim: boolean
  readonly pivot: Vec3
  readonly keys: readonly CameraKey[]
  readonly motion: ReshootMotion
  /** Appended to the trigger word: what the newly revealed areas hold. */
  readonly prompt: string
  readonly seed: number
}

function bindClip(graph: Graph, clip: ReshootClip): Graph {
  const bound: Graph = structuredClone(graph)
  bound['1'].inputs.file = clip.video
  Object.assign(bound['2'].inputs, {
    duration: MAX_SECONDS,
    aspect_ratio: clip.aspect,
    megapixels: MEGAPIXELS[clip.size]
  })
  return bound
}

export function analyzeWorkflow(clip: ReshootClip): Graph {
  return bindClip(analyzeGraph, clip)
}

/** The node counts frames from 1; the page's frame slider starts at 0. */
function keyframe(key: CameraKey, pivot: Vec3): Keyframe {
  const { azimuth, elevation, distance, shift } = key.camera
  return {
    f: key.frame + 1,
    az: azimuth,
    el: elevation,
    dist: distance,
    vs: shift,
    px: pivot[0],
    py: pivot[1],
    pz: pivot[2]
  }
}

export function generateWorkflow(shot: ReshootShot): Graph {
  const graph = bindClip(generateGraph, shot.clip)
  const { camera, pivot } = shot
  const moving = shot.keys.length >= 2
  // The pivot the page found is sent as given, so the generation orbits the
  // same point rather than re-estimating it at full resolution.
  Object.assign(graph['5'].inputs, {
    azimuth: camera.azimuth,
    elevation: camera.elevation,
    distance: camera.distance,
    hfov: camera.fov,
    vertical_shift: camera.shift,
    pivot_override: true,
    pivot_x: pivot[0],
    pivot_y: pivot[1],
    pivot_z: pivot[2],
    keep_source_aim: shot.keepAim,
    use_keyframes: moving,
    keyframes: moving
      ? JSON.stringify(shot.keys.map((key) => keyframe(key, pivot)))
      : '',
    interp_motion: shot.motion
  })
  const extra = shot.prompt.trim()
  graph['20'].inputs.prompt = extra ? `crossview. ${extra}` : 'crossview.'
  graph['30'].inputs.noise_seed = shot.seed
  return graph
}
