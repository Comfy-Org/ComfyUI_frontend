/**
 * The CrossView demo's whole backend conversation: Comfy API v2 against its
 * own deployment, through the local dev proxy (scripts/crossview-dev-proxy.mjs)
 * that holds the key. Nothing here touches the Hub's Cloud session or its run
 * engine; a real integration replaces PROXY with a server route of its own.
 */

import analyzeGraph from './analyze.api.json'
import generateGraph from './generate.api.json'
import type { Keyframe, Motion, Vec3 } from './camera'

const PROXY: string =
  import.meta.env.PUBLIC_CROSSVIEW_PROXY ?? 'http://127.0.0.1:4329'

type Graph = Record<
  string,
  { class_type: string; inputs: Record<string, unknown> }
>

export interface ClipSettings {
  /** The uploaded video's asset name. */
  readonly video: string
  readonly duration: number
  readonly aspect: string
  /** Generation size; both stages use it so the preview frames match. */
  readonly megapixels: number
}

interface CameraSettings {
  readonly azimuth: number
  readonly elevation: number
  readonly distance: number
  readonly hfov: number
  readonly verticalShift: number
  readonly pivot: Vec3
  readonly keepSourceAim: boolean
  readonly keyframes: readonly Keyframe[]
  readonly motion: Motion
}

export interface GenerateSettings {
  readonly clip: ClipSettings
  readonly camera: CameraSettings
  /** Appended to the trigger word: what the newly revealed areas hold. */
  readonly prompt: string
  readonly seed: number
}

function bindClip(graph: Graph, clip: ClipSettings): Graph {
  const g: Graph = structuredClone(graph)
  g['1'].inputs.file = clip.video
  Object.assign(g['2'].inputs, {
    duration: clip.duration,
    aspect_ratio: clip.aspect,
    megapixels: clip.megapixels
  })
  return g
}

export function analyzeWorkflow(clip: ClipSettings): Graph {
  return bindClip(analyzeGraph, clip)
}

export function generateWorkflow(settings: GenerateSettings): Graph {
  const g = bindClip(generateGraph, settings.clip)
  const c = settings.camera
  const moving = c.keyframes.length >= 2
  // The pivot the page previewed is sent as given, so the generation orbits
  // the same point rather than re-estimating it at full resolution.
  Object.assign(g['5'].inputs, {
    azimuth: c.azimuth,
    elevation: c.elevation,
    distance: c.distance,
    hfov: c.hfov,
    vertical_shift: c.verticalShift,
    pivot_override: true,
    pivot_x: c.pivot[0],
    pivot_y: c.pivot[1],
    pivot_z: c.pivot[2],
    keep_source_aim: c.keepSourceAim,
    use_keyframes: moving,
    keyframes: moving ? JSON.stringify(c.keyframes) : '',
    interp_motion: c.motion
  })
  const extra = settings.prompt.trim()
  g['20'].inputs.prompt = extra ? `crossview. ${extra}` : 'crossview.'
  g['30'].inputs.noise_seed = settings.seed
  return g
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(PROXY + path, init)
  const body = await response.text()
  if (!response.ok)
    throw new Error(
      `${init?.method ?? 'GET'} ${path}: ${response.status} ${body.slice(0, 300)}`
    )
  return JSON.parse(body) as T
}

/**
 * Upload the visitor's clip; returns the name LoadVideo reads it by. Assets
 * are content-addressed, so bytes uploaded before come back as the earlier
 * asset under its earlier name, and that name is the one to bind.
 */
export async function uploadVideo(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'
  const name = `crossview-${crypto.randomUUID()}.${ext}`
  const form = new FormData()
  form.set('file_path', name)
  form.set('content_type', file.type || 'video/mp4')
  form.set('file', file, name)
  const asset = await call<{ file_path?: string }>('/api/v2/assets', {
    method: 'POST',
    body: form
  })
  return asset.file_path ?? name
}

interface JobOutput {
  readonly id?: string
  readonly asset_id?: string
  readonly kind?: string
  readonly filename?: string
  readonly name?: string
  readonly content_type?: string
  readonly url?: string
}

export interface Job {
  readonly id: string
  readonly status: string
  readonly outputs?: readonly JobOutput[]
  readonly error?: unknown
  readonly progress?: { value?: number; max?: number; node?: string } | null
  readonly queue_position?: number | null
}

const DONE = new Set(['succeeded', 'completed', 'success'])
const FAILED = new Set([
  'failed',
  'error',
  'cancelled',
  'canceled',
  'lost',
  'expired',
  'non_retryable_error'
])

/**
 * Submit, riding out a deployment that is still coming up: it refuses jobs
 * with `deployment_not_ready` until its workers exist, which is a wait rather
 * than a failure.
 */
export async function submit(
  workflow: Graph,
  onWaiting: () => void,
  signal: AbortSignal
): Promise<string> {
  for (;;) {
    try {
      // A fresh key per attempt: a refused submission created no job, and
      // reusing the key could replay the refusal.
      const job = await call<Job>('/api/v2/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': crypto.randomUUID()
        },
        body: JSON.stringify({ workflow }),
        signal
      })
      return job.id
    } catch (error) {
      if (!String(error).includes('deployment_not_ready')) throw error
      onWaiting()
      await new Promise((resolve) => setTimeout(resolve, 10000))
      if (signal.aborted) throw new DOMException('Stopped', 'AbortError')
    }
  }
}

/** Poll until the job ends; `onUpdate` sees every snapshot on the way. */
export async function waitFor(
  id: string,
  onUpdate: (job: Job) => void,
  signal: AbortSignal
): Promise<Job> {
  for (;;) {
    if (signal.aborted) throw new DOMException('Stopped', 'AbortError')
    const job = await call<Job>(`/api/v2/jobs/${id}`, { signal })
    onUpdate(job)
    if (DONE.has(job.status)) return job
    if (FAILED.has(job.status))
      throw new Error(
        `The deployment reported ${job.status}: ${JSON.stringify(job.error ?? '').slice(0, 300)}`
      )
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}

export async function cancel(id: string): Promise<void> {
  await call(`/api/v2/jobs/${id}/cancel`, { method: 'POST' }).catch(() => {})
}

const nameOf = (o: JobOutput) => o.filename ?? o.name ?? ''

/** The first output whose file name contains `part`, as bytes. */
export async function download(job: Job, part: string): Promise<Blob> {
  const output = job.outputs?.find((o) => nameOf(o).includes(part))
  if (!output)
    throw new Error(
      `The job returned no ${part} file (got ${outputNames(job).join(', ') || 'nothing'}).`
    )
  const id = output.asset_id ?? output.id
  const response = await fetch(`${PROXY}/api/v2/assets/${id}/content`)
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)
  return response.blob()
}

/** Every output's file name, for error messages. */
const outputNames = (job: Job) => (job.outputs ?? []).map(nameOf)
