import { devServerPort, devServerUrl } from './devServerUrl'
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

export type DevServerProbe =
  | { status: 'not-running' }
  | { status: 'not-vite' }
  | { status: 'different-checkout' }
  | { status: 'ready' }

export async function probeDevServer(
  url: string,
  projectRoot?: string
): Promise<DevServerProbe> {
  let body: string
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (!res.ok && res.status !== 304) {
      console.error(`Status ${res.status}`)
      return { status: 'not-running' }
    }
    body = await res.text()
  } catch {
    return { status: 'not-running' }
  }

  if (!body.includes('/@vite/client')) return { status: 'not-vite' }
  if (projectRoot && (await servesThisCheckout(url, projectRoot)) === false) {
    return { status: 'different-checkout' }
  }
  return { status: 'ready' }
}

export function differentCheckoutInstructions(
  port: number,
  projectRoot: string
): string[] {
  return [
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
}

export async function checkDevServer(
  url = devServerUrl(),
  projectRoot?: string,
  autoStartScript?: string
): Promise<CheckResult> {
  const port = devServerPort()
  const probe = await probeDevServer(url, projectRoot)

  if (probe.status === 'not-running' && autoStartScript) {
    pass(NAME, `not running — will be auto-started (${autoStartScript})`)
    return { name: NAME, ok: true }
  }

  if (probe.status === 'not-running') {
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

  if (probe.status === 'not-vite') {
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

  if (probe.status === 'different-checkout' && projectRoot) {
    warn(NAME, `${url} is serving a different checkout`)
    const instructions = differentCheckoutInstructions(port, projectRoot)
    info(instructions)
    return {
      name: NAME,
      ok: false,
      version: url,
      installInstructions: instructions
    }
  }

  pass(NAME, url)
  return { name: NAME, ok: true, version: url }
}
