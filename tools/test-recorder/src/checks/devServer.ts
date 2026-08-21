import { devServerPort } from './devServerUrl'
import { fail, info, pass, warn } from '../ui/logger'
import type { CheckResult } from './types'

const NAME = 'Dev server'

/**
 * Vite answers 403 for /@fs paths outside its root, so asking for our own
 * index.html reveals whether this port serves this checkout.
 */
function fsProbeUrl(baseUrl: string, projectRoot: string): string {
  const normalised = projectRoot.replace(/\\/g, '/')
  const withLeadingSlash = normalised.startsWith('/')
    ? normalised
    : `/${normalised}`
  return `${baseUrl}/@fs${withLeadingSlash}/index.html`
}

async function servesThisCheckout(
  baseUrl: string,
  projectRoot: string
): Promise<boolean | undefined> {
  try {
    const res = await fetch(fsProbeUrl(baseUrl, projectRoot), {
      signal: AbortSignal.timeout(3000)
    })
    if (res.ok) return true
    if (res.status === 403 || res.status === 404) return false
    return undefined
  } catch {
    return undefined
  }
}

export async function checkDevServer(
  port = devServerPort(),
  projectRoot?: string
): Promise<CheckResult> {
  const url = `http://localhost:${port}`

  let body: string
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (!res.ok && res.status !== 304) throw new Error(`Status ${res.status}`)
    body = await res.text()
  } catch {
    fail(NAME, `not running on :${port}`)
    const instructions = [
      'Start the Vite dev server in another terminal:',
      '',
      '  pnpm dev',
      '',
      `Then wait for it to show "Local: http://localhost:${port}"`,
      '',
      `If you run it on a different port, set COMFY_TEST_DEV_PORT=<port>.`
    ]
    info(instructions)
    return { name: NAME, ok: false, installInstructions: instructions }
  }

  if (!body.includes('/@vite/client')) {
    warn(NAME, `${url} is not a Vite dev server`)
    const instructions = [
      `Something is listening on :${port}, but it is not the Vite dev server.`,
      'Recordings made against it will not reflect your local source changes.',
      '',
      'Stop whatever owns that port, then run:',
      '',
      '  pnpm dev'
    ]
    info(instructions)
    return {
      name: NAME,
      ok: false,
      version: url,
      installInstructions: instructions
    }
  }

  if (projectRoot) {
    const mine = await servesThisCheckout(url, projectRoot)
    if (mine === false) {
      warn(NAME, `${url} is serving a different checkout`)
      const instructions = [
        `The dev server on :${port} was started from another folder, so it is`,
        'not serving the code you are working on. Anything you record would',
        'test that other checkout instead.',
        '',
        `This checkout: ${projectRoot}`,
        '',
        'Either stop that server and run `pnpm dev` here, or start one on a',
        'free port and point the recorder at it:',
        '',
        '  pnpm dev --port 5174 --strictPort',
        '  COMFY_TEST_DEV_PORT=5174 pnpm comfy-test record',
        '',
        'Note: do not write `pnpm dev -- --port`. Vite ignores everything',
        'after a bare `--`, and silently picks a different port instead.'
      ]
      info(instructions)
      return {
        name: NAME,
        ok: false,
        version: url,
        installInstructions: instructions
      }
    }
  }

  pass(NAME, url)
  return { name: NAME, ok: true, version: url }
}
