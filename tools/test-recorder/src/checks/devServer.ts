import { pass, fail, info } from '../ui/logger'
import type { CheckResult } from './types'

export async function checkDevServer(port = 5173): Promise<CheckResult> {
  const url = `http://localhost:${port}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (res.ok || res.status === 304) {
      pass('Dev server', url)
      return { name: 'Dev server', ok: true, version: url }
    }
    throw new Error(`Status ${res.status}`)
  } catch {
    fail('Dev server', `not running on :${port}`)
    const instructions = [
      'Start the Vite dev server in another terminal:',
      '',
      '  pnpm dev',
      '',
      `Then wait for it to show "Local: http://localhost:${port}"`
    ]
    info(instructions)
    return { name: 'Dev server', ok: false, installInstructions: instructions }
  }
}
