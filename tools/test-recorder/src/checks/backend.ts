import { pass, fail, info } from '../ui/logger'
import type { CheckResult } from './types'

export async function checkBackend(port = 8188): Promise<CheckResult> {
  const url = `http://localhost:${port}`
  try {
    const res = await fetch(`${url}/system_stats`, {
      signal: AbortSignal.timeout(3000)
    })
    if (res.ok) {
      pass('ComfyUI backend', url)
      return { name: 'ComfyUI backend', ok: true, version: url }
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
