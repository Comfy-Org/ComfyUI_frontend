import type { RunProgress } from '../../../components/workshop/app-editor/run-progress'
import { clockProgress } from '../../../components/workshop/app-editor/run-progress'
import { mockJob } from '../mock-job'
import type { TryOnRequest, TryOnResult } from './contract'
import type { Area, Point } from './garments'
import {
  EXAMPLE_GARMENTS,
  EXAMPLE_TORSO,
  UPLOAD_FABRIC,
  UPLOAD_TORSO,
  fittedOutline
} from './garments'
import { renderTryOn } from './render-image'

/** Where the mock draws the garment and which part of it is cloth. */
export interface TryOnScene {
  readonly outline: readonly Point[]
  readonly fabric: Area
}

/** Draws a request's result image, as an object URL, or undefined. */
export type TryOnRender = (
  request: TryOnRequest,
  scene: TryOnScene
) => Promise<string | undefined>

export const TRY_ON_CREDITS = 8

const MOCK_DELAY_MS = 2400
const MOCK_QUEUE_MS = 400

export const TRY_ON_PERSON = {
  url: '/images/apps/virtual-try-on/person.jpg',
  name: 'motel-balcony.jpg',
  width: 450,
  height: 720
} as const

/**
 * How far along a run is after `elapsedMs`. The mock reads it off the
 * clock: queued at first, then running towards 99% until it answers. The
 * real job reports the same two stages.
 */
export function mockProgress(elapsedMs: number): RunProgress {
  return clockProgress(elapsedMs, MOCK_DELAY_MS, MOCK_QUEUE_MS)
}

/**
 * The mock's stand-in for segmentation: the traced jacket on the example
 * photo or a generic torso on any other, shaped by the fit, and the
 * example garment's known cloth or the middle of an uploaded one.
 */
export function tryOnScene(request: TryOnRequest): TryOnScene {
  const torso =
    request.person === TRY_ON_PERSON.url ? EXAMPLE_TORSO : UPLOAD_TORSO
  const example = EXAMPLE_GARMENTS.find(
    (garment) => garment.url === request.garment
  )
  return {
    outline: fittedOutline(torso, request.fit),
    fabric: example?.fabric ?? UPLOAD_FABRIC
  }
}

/** The example photo of the example person wearing an example garment. */
function preparedResult(request: TryOnRequest): string | undefined {
  if (request.person !== TRY_ON_PERSON.url) return undefined
  const example = EXAMPLE_GARMENTS.find(
    (garment) => garment.url === request.garment
  )
  return example && `/images/apps/virtual-try-on/result-${example.id}.jpg`
}

/**
 * Stands in for the Virtual try-on backend until it exists: waits, then
 * answers with the example photo for the examples (`preparedResult`), the
 * garment drawn over the person (`render`), or the photo itself where that
 * cannot draw. Replace this with the real job call; the page only needs
 * the same request and result shapes.
 */
export async function runTryOn(
  request: TryOnRequest,
  signal: AbortSignal,
  render: TryOnRender = renderTryOn
): Promise<TryOnResult> {
  const prepared = preparedResult(request)
  const rendered = prepared
    ? undefined
    : render(request, tryOnScene(request)).catch(() => undefined)
  try {
    await mockJob(undefined, signal, MOCK_DELAY_MS)
  } catch (error) {
    void rendered?.then((url) => url && URL.revokeObjectURL(url))
    throw error
  }
  const url = prepared ?? (await rendered) ?? request.person
  return { url, seed: request.seed }
}
