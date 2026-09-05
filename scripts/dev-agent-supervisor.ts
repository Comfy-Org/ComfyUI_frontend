import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { rm } from 'node:fs/promises'

export async function assertReachable(url: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
}

export function spawnGroup(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): ChildProcess {
  return spawn(command, args, {
    cwd,
    detached: process.platform !== 'win32',
    env,
    stdio: 'inherit'
  })
}

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

function isMissingProcess(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ESRCH'
  )
}

function groupIsAlive(child: ChildProcess): boolean {
  if (child.pid === undefined) return false
  if (process.platform === 'win32') return !hasExited(child)
  try {
    process.kill(-child.pid, 0)
    return true
  } catch (error) {
    return !isMissingProcess(error)
  }
}

function stopGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return
  if (process.platform === 'win32') {
    if (!hasExited(child)) child.kill(signal)
    return
  }
  try {
    process.kill(-child.pid, signal)
  } catch (error) {
    if (!isMissingProcess(error) && !hasExited(child)) child.kill(signal)
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms))
}

async function waitForExit(
  child: ChildProcess,
  timeoutMs: number
): Promise<void> {
  if (hasExited(child)) return
  await Promise.race([
    new Promise<void>((resolveExit) => child.once('exit', () => resolveExit())),
    wait(timeoutMs)
  ])
}

async function waitForGroupExit(
  child: ChildProcess,
  timeoutMs: number
): Promise<void> {
  if (process.platform === 'win32') return await waitForExit(child, timeoutMs)
  const deadline = Date.now() + timeoutMs
  while (groupIsAlive(child) && Date.now() < deadline) await wait(50)
}

export async function waitForHttp(
  child: ChildProcess,
  url: string,
  stopped: () => boolean,
  label: string
): Promise<void> {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline && !stopped()) {
    if (hasExited(child)) {
      throw new Error(`${label} exited with code ${child.exitCode}`)
    }
    try {
      await assertReachable(url)
      return
    } catch {
      await wait(500)
    }
  }
  if (stopped()) return
  throw new Error(`${label} did not become ready at ${url}`)
}

export function waitForStartup(
  child: ChildProcess,
  url: string,
  label: string,
  supervisor: {
    exitRequested: Promise<number>
    requested: () => boolean
  }
): Promise<number | null> {
  return Promise.race([
    waitForHttp(child, url, supervisor.requested, label).then(() => null),
    supervisor.exitRequested
  ])
}

// One lifecycle for a spawned group: the first exit reason wins and teardown runs once.
export function supervise(dataDir: string) {
  const children: ChildProcess[] = []
  let stopping = false
  let requestedExitCode: number | null = null
  let resolveExitRequest: (code: number) => void = () => {}
  const exitRequested = new Promise<number>((resolveExit) => {
    resolveExitRequest = resolveExit
  })
  const requestExit = (code: number) => {
    if (requestedExitCode !== null) return
    requestedExitCode = code
    resolveExitRequest(code)
  }
  const onSigint = () => requestExit(130)
  const onSigterm = () => requestExit(143)
  process.once('SIGINT', onSigint)
  process.once('SIGTERM', onSigterm)
  return {
    exitRequested,
    requested: () => requestedExitCode !== null,
    // Signalled newest first, so a dependent stops before what it was talking to.
    stop: async (exitCode: number): Promise<number> => {
      if (stopping) return exitCode
      stopping = true
      const newestFirst = [...children].reverse()
      try {
        for (const child of newestFirst) stopGroup(child, 'SIGTERM')
        await Promise.all(
          newestFirst.map((child) => waitForGroupExit(child, 2000))
        )
        for (const child of newestFirst) {
          if (groupIsAlive(child)) stopGroup(child, 'SIGKILL')
        }
        await Promise.all(
          newestFirst.map((child) => waitForGroupExit(child, 1000))
        )
        const liveGroups = newestFirst.filter(groupIsAlive)
        if (liveGroups.length > 0) {
          throw new Error(
            `Process groups ${liveGroups.map((child) => child.pid).join(', ')} are still running; preserved ${dataDir}`
          )
        }
        await rm(dataDir, { force: true, recursive: true })
      } finally {
        process.removeListener('SIGINT', onSigint)
        process.removeListener('SIGTERM', onSigterm)
      }
      return exitCode
    },
    watch: (child: ChildProcess) => {
      children.push(child)
      child.once('exit', (code) => requestExit(code ?? 1))
      child.once('error', () => requestExit(1))
    }
  }
}
