import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { supervise, waitForHttp } from './dev-agent-supervisor'

vi.mock('node:child_process', () => {
  const mocked = { spawn: vi.fn() }
  return { ...mocked, default: mocked }
})
vi.mock('node:fs/promises', () => {
  const mocked = { rm: vi.fn() }
  return { ...mocked, default: mocked }
})

class FakeChild extends EventEmitter {
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  kill = vi.fn()
  constructor(readonly pid: number | undefined) {
    super()
  }
  exit(code: number | null, signal: NodeJS.Signals | null = null) {
    this.exitCode = code
    this.signalCode = signal
    this.emit('exit', code, signal)
  }
}

function asChild(fake: FakeChild): ChildProcess {
  return fake as unknown as ChildProcess
}

describe('supervise', () => {
  let children: FakeChild[]
  let killed: Array<[number, NodeJS.Signals]>

  beforeEach(() => {
    children = []
    killed = []
    let nextPid = 100
    vi.mocked(spawn).mockImplementation(() => {
      const child = new FakeChild(nextPid++)
      children.push(child)
      return asChild(child)
    })
    vi.mocked(rm).mockResolvedValue(undefined)
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      killed.push([pid, signal as NodeJS.Signals])
      return true
    })
  })

  function stopAndFlush(supervisor: ReturnType<typeof supervise>, code = 0) {
    const stopped = supervisor.stop(code)
    return vi.advanceTimersByTimeAsync(4000).then(() => stopped)
  }

  it('registers every spawned child so stop signals it newest first', async () => {
    const supervisor = supervise('/tmp/data')
    supervisor.spawn('a', [], '/cwd', {})
    supervisor.spawn('b', [], '/cwd', {})
    supervisor.spawn('c', [], '/cwd', {})
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      killed.push([pid, signal as NodeJS.Signals])
      children.find((child) => -child.pid! === pid)?.exit(null, 'SIGTERM')
      return true
    })

    await expect(stopAndFlush(supervisor, 7)).resolves.toBe(7)

    expect(killed).toEqual([
      [-102, 'SIGTERM'],
      [-101, 'SIGTERM'],
      [-100, 'SIGTERM']
    ])
    expect(rm).toHaveBeenCalledWith('/tmp/data', {
      force: true,
      recursive: true
    })
  })

  it('returns the spawned child and passes the spawn arguments through', async () => {
    const supervisor = supervise('/tmp/data')
    const env = { TOKEN: 'x' }

    const child = supervisor.spawn('cmd', ['--flag'], '/cwd', env)

    expect(child).toBe(asChild(children[0]))
    expect(spawn).toHaveBeenCalledWith(
      'cmd',
      ['--flag'],
      expect.objectContaining({ cwd: '/cwd', env, stdio: 'inherit' })
    )
    await stopAndFlush(supervisor)
  })

  it('requests exit with the first child exit code and ignores later ones', async () => {
    const supervisor = supervise('/tmp/data')
    supervisor.spawn('a', [], '/cwd', {})
    supervisor.spawn('b', [], '/cwd', {})
    expect(supervisor.requested()).toBe(false)

    children[1].exit(3)
    children[0].exit(0)

    expect(supervisor.requested()).toBe(true)
    await expect(supervisor.exitRequested).resolves.toBe(3)
    await stopAndFlush(supervisor)
  })

  it('treats an unsolicited clean child exit as failure', async () => {
    const supervisor = supervise('/tmp/data')
    supervisor.spawn('service', [], '/cwd', {})

    children[0].exit(0)

    await expect(supervisor.exitRequested).resolves.toBe(1)
    await stopAndFlush(supervisor)
  })

  it('does not report HTTP readiness after shutdown starts', async () => {
    const child = new FakeChild(100)

    await expect(
      waitForHttp(asChild(child), 'http://127.0.0.1:1', () => true, 'Vite')
    ).rejects.toThrow('Vite stopped before becoming ready')
  })

  it('maps a signal exit and a spawn error to exit code 1', async () => {
    const bySignal = supervise('/tmp/a')
    bySignal.spawn('a', [], '/cwd', {})
    children[0].exit(null, 'SIGKILL')
    await expect(bySignal.exitRequested).resolves.toBe(1)
    await stopAndFlush(bySignal)

    const byError = supervise('/tmp/b')
    byError.spawn('missing', [], '/cwd', {})
    children[1].emit('error', new Error('ENOENT'))
    await expect(byError.exitRequested).resolves.toBe(1)
    await stopAndFlush(byError)
  })

  it('escalates to SIGKILL when a child ignores SIGTERM and runs teardown once', async () => {
    const supervisor = supervise('/tmp/data')
    supervisor.spawn('stubborn', [], '/cwd', {})
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      killed.push([pid, signal as NodeJS.Signals])
      if (signal === 'SIGKILL') children[0].exit(null, 'SIGKILL')
      return true
    })

    const first = stopAndFlush(supervisor, 130)
    const second = supervisor.stop(0)
    await expect(first).resolves.toBe(130)
    await expect(second).resolves.toBe(0)

    expect(killed).toEqual([
      [-100, 'SIGTERM'],
      [-100, 'SIGKILL']
    ])
    expect(rm).toHaveBeenCalledOnce()
  })

  it('skips children that never got a pid and removes its signal handlers', async () => {
    const sigintBefore = process.listenerCount('SIGINT')
    const sigtermBefore = process.listenerCount('SIGTERM')
    const sighupBefore = process.listenerCount('SIGHUP')
    vi.mocked(spawn).mockImplementation(() => asChild(new FakeChild(undefined)))
    const supervisor = supervise('/tmp/data')
    supervisor.spawn('a', [], '/cwd', {})
    expect(process.listenerCount('SIGINT')).toBe(sigintBefore + 1)
    expect(process.listenerCount('SIGTERM')).toBe(sigtermBefore + 1)
    expect(process.listenerCount('SIGHUP')).toBe(sighupBefore + 1)

    await expect(stopAndFlush(supervisor)).resolves.toBe(0)

    expect(killed).toEqual([])
    expect(process.listenerCount('SIGINT')).toBe(sigintBefore)
    expect(process.listenerCount('SIGTERM')).toBe(sigtermBefore)
    expect(process.listenerCount('SIGHUP')).toBe(sighupBefore)
  })

  it('kills children immediately when a signal repeats during teardown', async () => {
    const supervisor = supervise('/tmp/data')
    supervisor.spawn('stubborn', [], '/cwd', {})

    process.emit('SIGINT', 'SIGINT')
    process.emit('SIGINT', 'SIGINT')
    children[0].exit(null, 'SIGKILL')
    await vi.advanceTimersByTimeAsync(1000)

    await expect(supervisor.exitRequested).resolves.toBe(130)
    expect(killed).toContainEqual([-100, 'SIGKILL'])
    await supervisor.stop(130)
  })
})
