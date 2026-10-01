/**
 * A Re-shoot deployment that answers at once: every job runs for one poll,
 * then succeeds with the outputs its stage produces.
 */
import { vi } from 'vitest'
import { computed } from 'vue'

import type { AccountCredential } from '@comfyorg/account-core/session'

import { useWorkshopSession } from '../../../../../config/workshop-session-state'
import type { Geometry } from '../cvgeo'
import type { ReshootJob, ReshootQuote, ReshootTransport } from '../transport'

export const FREE_QUOTE: ReshootQuote = {
  free_runs_allowance: { runs: 5, period: 'P7D', period_seconds: 604_800 },
  free_runs_remaining: 3,
  resets_at: null,
  price_credits: 40,
  next_run: 'free'
}

function outputsOf(workflow: object): ReshootJob['outputs'] {
  return JSON.stringify(workflow).includes('CrossViewGeometryExport')
    ? [{ id: 'geo', filename: 'crossview/geometry.cvgeo' }]
    : [
        { id: 'res', filename: 'crossview/result_00001_.mp4' },
        { id: 'warp', filename: 'crossview/warp_00001_.mp4' },
        { id: 'orig', filename: 'crossview/original-audio_00001_.mp4' }
      ]
}

export function fakeTransport(): ReshootTransport {
  const jobs = new Map<string, ReshootJob>()
  return {
    quote: vi.fn(async () => FREE_QUOTE),
    upload: vi.fn(async () => 'clip.mp4'),
    submit: vi.fn(async (workflow: object) => {
      const id = `job-${jobs.size + 1}`
      jobs.set(id, { id, status: 'succeeded', outputs: outputsOf(workflow) })
      return { id, status: 'running', outputs: [] }
    }),
    job: vi.fn(async (id: string) => {
      const job = jobs.get(id)
      if (!job) throw new Error(`no job ${id}`)
      return job
    }),
    output: vi.fn(async () => new Blob(['bytes'])),
    cancel: vi.fn(async () => {})
  }
}

export function fakeGeometry(frames = 97): Geometry {
  const plane = new Float32Array(16).fill(2)
  return {
    frames,
    width: 4,
    height: 4,
    fps: 24,
    sourceWidth: 864,
    sourceHeight: 480,
    fxNorm: null,
    jpegs: [],
    depth: [plane],
    depthHalf: [new Uint16Array(16)]
  }
}

export const RESHOOT_CREDENTIAL: AccountCredential = {
  token: 'workspace-jwt',
  expiresAt: Date.now() + 60_000,
  uid: 'user-1',
  workspace: { id: 'workspace-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: []
}

/** Needs `vi.mock` of workshop-session-state in the calling suite. */
export function signIn(credential: AccountCredential = RESHOOT_CREDENTIAL) {
  const session = useWorkshopSession()
  session.session = computed(() => credential)
  vi.mocked(session.ensureFresh).mockResolvedValue({
    status: 'ok',
    session: credential
  })
}
