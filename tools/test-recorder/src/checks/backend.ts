import { pass, fail, warn, info } from '../ui/logger'
import type { CheckResult } from './types'

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
    return typeof body === 'object' && body !== null && 'users' in body
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

      warn('ComfyUI backend', `running on :${port} without --multi-user`)
      const instructions = [
        'The backend is running, but not with --multi-user.',
        '',
        'Without it, every test shares one user account, and tests run',
        "locally can collide with each other over that user's data",
        '(templates, settings, workflows) in ways CI never sees.',
        '',
        'Stop the backend and restart it with:',
        '',
        '  python main.py --multi-user'
      ]
      info(instructions)
      return {
        name: 'ComfyUI backend',
        ok: true,
        optional: true,
        version: url,
        installInstructions: instructions
      }
    }
    throw new Error(`Status ${res.status}`)
  } catch {
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
}
