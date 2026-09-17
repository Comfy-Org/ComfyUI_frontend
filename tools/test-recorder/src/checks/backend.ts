import { pass, fail, alert, info } from '../ui/logger'
import type { CheckResult } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * `/api/users` shape is the only signal that distinguishes multi-user mode:
 * it returns `{ users: {...} }` when `--multi-user` is on, or
 * `{ migrated: bool }` when it's off. `/system_stats` carries no such field.
 */
async function isMultiUser(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/users`, {
      signal: AbortSignal.timeout(3000)
    })
    if (!res.ok) return false
    const body: unknown = await res.json()
    return isRecord(body) && isRecord(body.users)
  } catch {
    return false
  }
}

export async function checkBackend(port = 8188): Promise<CheckResult> {
  const url = `http://localhost:${port}`
  try {
    const res = await fetch(`${url}/system_stats`, {
      signal: AbortSignal.timeout(3000)
    })
    if (res.ok) {
      if (await isMultiUser(url)) {
        pass('ComfyUI backend', url)
        return { name: 'ComfyUI backend', ok: true, version: url }
      }

      const instructions = [
        `Backend is running on :${port} WITHOUT --multi-user.`,
        '',
        'Every test will share one user account, and tests run locally',
        "WILL collide with each other over that user's data (templates,",
        'settings, workflows) — this is not cosmetic, tests will flake or',
        'fail in ways CI never sees, because CI always uses --multi-user.',
        '',
        'FIX: stop the backend and restart it with:',
        '',
        '  python main.py --multi-user'
      ]
      alert('Backend is not running in multi-user mode', instructions)
      return {
        name: 'ComfyUI backend',
        ok: true,
        optional: true,
        version: url,
        installInstructions: instructions
      }
    }
    console.error(`Status ${res.status}`)
  } catch {
    console.error(`ComfyUI backend not running on :${port}`)
  }

  fail('ComfyUI backend', `not running on :${port}`)
  const instructions = [
    'ComfyUI backend must be running for browser tests.',
    '',
    'In a separate terminal, navigate to your ComfyUI folder and run:',
    '',
    '  python main.py --multi-user',
    '',
    '⚠️  The --multi-user flag is REQUIRED for parallel test support.'
  ]
  info(instructions)
  return {
    name: 'ComfyUI backend',
    ok: false,
    installInstructions: instructions
  }
}
