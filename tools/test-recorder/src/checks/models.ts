import { info, pass, warn } from '../ui/logger'
import type { CheckResult } from './types'

const NAME = 'Checkpoints'

function readCheckpointNames(body: unknown): string[] {
  if (typeof body !== 'object' || body === null) return []
  const node = (body as Record<string, unknown>).CheckpointLoaderSimple
  if (typeof node !== 'object' || node === null) return []
  const input = (node as Record<string, unknown>).input
  if (typeof input !== 'object' || input === null) return []
  const required = (input as Record<string, unknown>).required
  if (typeof required !== 'object' || required === null) return []
  const spec = (required as Record<string, unknown>).ckpt_name
  if (!Array.isArray(spec)) return []
  const names = spec[0]
  return Array.isArray(names) ? names.filter((n) => typeof n === 'string') : []
}

/**
 * With no checkpoints the Missing Models dialog covers the canvas, and every
 * recorded click then fails with "intercepts pointer events".
 */
export async function checkModels(port = 8188): Promise<CheckResult> {
  try {
    const res = await fetch(
      `http://localhost:${port}/object_info/CheckpointLoaderSimple`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) {
      console.error(`Status ${res.status}`)
      return { name: NAME, ok: true, optional: true }
    }

    const body: unknown = await res.json()
    const names = readCheckpointNames(body)

    if (names.length > 0) {
      pass(NAME, `${names.length} available`)
      return { name: NAME, ok: true, optional: true }
    }

    warn(NAME, 'none installed')
    info([
      'This ComfyUI has no checkpoints, so loading a workflow that needs one',
      'raises the Missing Models dialog. That dialog covers the canvas, and',
      'recorded clicks then fail with "intercepts pointer events".',
      '',
      'Either install a checkpoint, or start your recording from',
      '(empty canvas) or a workflow that needs no models.'
    ])
    return { name: NAME, ok: false, optional: true }
  } catch {
    // The backend check already reports an unreachable server; stay quiet.
    return { name: NAME, ok: true, optional: true }
  }
}
