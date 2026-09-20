import { spawn } from 'node:child_process'

import type { Distribution } from './distributions'
import {
  differentCheckoutInstructions,
  probeDevServer
} from '../checks/devServer'
import { devServerPort, devServerUrl } from '../checks/devServerUrl'

export interface ManagedDevServer {
  url: string
  ownedByUs: boolean
  reused: boolean
  stop: () => void
}

const START_TIMEOUT_MS = 60_000
const POLL_INTERVAL_MS = 500

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * A `--backend <url>` run configures the dev server entirely through the
 * environment of the process that starts it: `DEV_SERVER_COMFYUI_URL` picks the
 * backend and `DEV_SERVER_CF_ACCESS_CLIENT_ID`/`_SECRET` decide whether the
 * proxy forwards a Cloudflare Access service token. None of that is reported
 * back over the wire, so a Vite we did not start cannot be shown to match the
 * requested backend. Reusing it would silently record against whatever host
 * that server proxies to, or land on the Access login page with no token.
 */
function reuseNeedsThisProcessToConfigureIt(
  distribution: Distribution
): boolean {
  return distribution.id === 'custom'
}

function unverifiableReuseInstructions(
  port: number,
  backendUrl: string | undefined
): string[] {
  const backend = backendUrl ?? 'the selected backend'
  return [
    `A Vite dev server is already running on :${port}, but the recorder cannot`,
    'tell which backend it proxies to, or whether it carries a Cloudflare',
    'Access service token. Both come from the environment of whoever started',
    'it, so reusing it could record against the wrong backend or leave the app',
    'on the Access login page.',
    '',
    `Requested backend: ${backend}`,
    '',
    'Stop that server and run this command again so the recorder starts one',
    'with the right configuration, or start a dedicated one on a free port:',
    '',
    `  DEV_SERVER_COMFYUI_URL=${backend} pnpm dev --port 5174 --strictPort`,
    `  COMFY_TEST_DEV_PORT=5174 pnpm comfy-test record --backend ${backend}`,
    '',
    'Export DEV_SERVER_CF_ACCESS_CLIENT_ID and',
    'DEV_SERVER_CF_ACCESS_CLIENT_SECRET in that terminal if the backend is',
    'behind Cloudflare Access.'
  ]
}

export async function ensureDevServer(
  distribution: Distribution,
  projectRoot: string
): Promise<ManagedDevServer> {
  const url = devServerUrl()
  const initial = await probeDevServer(url, projectRoot)
  if (initial.status === 'ready') {
    if (reuseNeedsThisProcessToConfigureIt(distribution)) {
      throw new Error(
        unverifiableReuseInstructions(
          devServerPort(),
          distribution.backendUrl
        ).join('\n')
      )
    }
    return { url, ownedByUs: false, reused: true, stop: () => {} }
  }
  if (initial.status === 'different-checkout') {
    throw new Error(
      differentCheckoutInstructions(devServerPort(), projectRoot).join('\n')
    )
  }
  if (initial.status === 'not-vite') {
    throw new Error(
      `Something is listening on ${url}, but it is not a Vite dev server.`
    )
  }

  const child = spawn('pnpm', ['run', distribution.script], {
    cwd: projectRoot,
    stdio: 'ignore',
    detached: true,
    env: distribution.backendUrl
      ? { ...process.env, DEV_SERVER_COMFYUI_URL: distribution.backendUrl }
      : process.env
  })
  let spawnError: Error | undefined
  child.once('error', (error) => {
    spawnError = error
  })
  child.unref()

  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    if (child.pid === undefined) return
    try {
      // A detached child leads its process group, so this also terminates Vite.
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      child.kill('SIGTERM')
    }
  }
  const onSignal = () => {
    stop()
  }
  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)

  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    await wait(POLL_INTERVAL_MS)
    if (spawnError) {
      stop()
      throw new Error(`Could not start dev server: ${spawnError.message}`)
    }
    const probe = await probeDevServer(url, projectRoot)
    if (probe.status === 'ready') {
      return { url, ownedByUs: true, reused: false, stop }
    }
    if (child.exitCode !== null) {
      stop()
      throw new Error(
        `Dev server (${distribution.script}) exited before becoming ready.`
      )
    }
  }

  stop()
  throw new Error(
    `Dev server (${distribution.script}) did not become ready at ${url} within 60 seconds.`
  )
}
