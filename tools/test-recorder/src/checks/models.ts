import { info, pass, warn } from '../ui/logger'
import type { CheckResult } from './types'

const NAME = 'Checkpoints'

/**
 * Most bundled workflows reference a checkpoint. If the backend has none,
 * loading one raises the Missing Models dialog, which covers the canvas and
 * makes every recorded click fail with "intercepts pointer events" — a
 * confusing failure to hit after a recording has already been made.
 */
export async function checkModels(port = 8188): Promise<CheckResult> {
  try {
    const res = await fetch(
      `http://localhost:${port}/object_info/CheckpointLoaderSimple`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) throw new Error(`Status ${res.status}`)

    const body = await res.json()
    const names =
      body?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] ?? []

    if (Array.isArray(names) && names.length > 0) {
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
