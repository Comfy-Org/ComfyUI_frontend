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

export async function ensureDevServer(
  distribution: Distribution,
  projectRoot: string
): Promise<ManagedDevServer> {
  const url = devServerUrl()
  const initial = await probeDevServer(url, projectRoot)
  if (initial.status === 'ready') {
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
