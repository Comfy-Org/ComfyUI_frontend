import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { rm } from 'node:fs/promises'

export async function assertReachable(url: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
}

function spawnGroup(
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

function stopGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined || hasExited(child)) return
  try {
    if (process.platform === 'win32') child.kill(signal)
    else process.kill(-child.pid, signal)
  } catch {
    child.kill(signal)
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
  function watch(child: ChildProcess): void {
    children.push(child)
    child.once('exit', (code) => requestExit(code ?? 1))
    child.once('error', () => requestExit(1))
  }
  return {
    exitRequested,
    requested: () => requestedExitCode !== null,
    spawn(
      command: string,
      args: string[],
      cwd: string,
      env: NodeJS.ProcessEnv
    ): ChildProcess {
      const child = spawnGroup(command, args, cwd, env)
      watch(child)
      return child
    },
    // Signalled newest first, so a dependent stops before what it was talking to.
    stop: async (exitCode: number): Promise<number> => {
      if (stopping) return exitCode
      stopping = true
      const newestFirst = [...children].reverse()
      for (const child of newestFirst) stopGroup(child, 'SIGTERM')
      await Promise.all(newestFirst.map((child) => waitForExit(child, 2000)))
      for (const child of newestFirst) {
        if (!hasExited(child)) stopGroup(child, 'SIGKILL')
      }
      await Promise.all(newestFirst.map((child) => waitForExit(child, 1000)))
      await rm(dataDir, { force: true, recursive: true })
      process.removeListener('SIGINT', onSigint)
      process.removeListener('SIGTERM', onSigterm)
      return exitCode
    }
  }
}
