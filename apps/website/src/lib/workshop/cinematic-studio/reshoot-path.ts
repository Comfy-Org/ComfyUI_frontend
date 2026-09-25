/**
 * The camera move: the page's keys (a camera per 0-based frame) against the
 * node's keyframes (1-based poses around a pivot), and the camera at any
 * frame of the move, as the node will fly it.
 */
import type { CameraKey, ReshootCamera, ReshootMotion } from './reshoot'
import type { Keyframe, Pose, Vec3 } from './reshoot-engine/camera'
import { samplePath } from './reshoot-engine/camera'

export function toKeyframes(
  keys: readonly CameraKey[],
  pivot: Vec3
): Keyframe[] {
  return keys.map(({ frame, camera }) => ({
    f: frame + 1,
    az: camera.azimuth,
    el: camera.elevation,
    dist: camera.distance,
    vs: camera.shift,
    px: pivot[0],
    py: pivot[1],
    pz: pivot[2]
  }))
}

/**
 * The camera at a frame: the one camera with no keys, held from a single
 * key, and along the path from two. The lens is not keyed (the node takes
 * one hfov for the whole clip), so it always comes from `base`.
 */
export function cameraAt(
  keys: readonly CameraKey[],
  frame: number,
  motion: ReshootMotion,
  base: Readonly<ReshootCamera>
): ReshootCamera {
  if (keys.length === 0) return { ...base }
  if (keys.length === 1) return { ...keys[0].camera, fov: base.fov }
  const pose: Pose = samplePath(toKeyframes(keys, [0, 0, 1]), frame + 1, motion)
  return {
    azimuth: pose.az,
    elevation: pose.el,
    distance: pose.dist,
    fov: base.fov,
    shift: pose.vs
  }
}

/** The camera as the sliders and readouts show it. */
export function roundCamera(camera: Readonly<ReshootCamera>): ReshootCamera {
  return {
    azimuth: Math.round(camera.azimuth),
    elevation: Math.round(camera.elevation),
    distance: Math.round(camera.distance * 100) / 100,
    fov: camera.fov,
    shift: Math.round(camera.shift * 100) / 100
  }
}

export function keyIndexAt(keys: readonly CameraKey[], frame: number): number {
  return keys.findIndex((key) => key.frame === frame)
}
