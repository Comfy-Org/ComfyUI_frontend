import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/api', () => {
  class FakeApi extends EventTarget {
    getQueue = vi.fn()
    getHistory = vi.fn()
    getJobDetail = vi.fn()
  }
  return { api: new FakeApi() }
})

import { api } from '@/scripts/api'

import { CommandRegistryImpl } from '../runtime'
import type { CmdContext } from '../types'
import { collect, emptyIter } from '../types'
import { MemoryVFS } from '../vfs/memory'
import { registerExecutionCommands } from './execution'

const mocked = vi.mocked(api)

function ctx(argv: string[], signal?: AbortSignal): CmdContext {
  return {
    argv,
    stdin: emptyIter(),
    env: new Map(),
    cwd: '/',
    vfs: new MemoryVFS(),
    signal: signal ?? new AbortController().signal
  }
}

describe('execution commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queue-status lists running and pending', async () => {
    mocked.getQueue.mockResolvedValue({
      Running: [
        { id: 'r1', status: 'in_progress', create_time: 1, priority: 0 }
      ],
      Pending: [
        { id: 'p1', status: 'pending', create_time: 2, priority: 0 },
        { id: 'p2', status: 'pending', create_time: 3, priority: 0 }
      ]
    })
    const r = new CommandRegistryImpl()
    registerExecutionCommands(r)
    const res = await r.get('queue-status')!(ctx(['queue-status']))
    const out = await collect(res.stdout)
    expect(out).toContain('running: 1')
    expect(out).toContain('pending: 2')
    expect(out).toContain('r1')
    expect(out).toContain('p2')
  })

  it('history --last=2 returns 2 rows', async () => {
    mocked.getHistory.mockResolvedValue([
      {
        id: 'a',
        status: 'completed',
        create_time: 1,
        priority: 0
      },
      {
        id: 'b',
        status: 'completed',
        create_time: 2,
        priority: 0
      }
    ])
    const r = new CommandRegistryImpl()
    registerExecutionCommands(r)
    const res = await r.get('history')!(ctx(['history', '--last=2']))
    expect(mocked.getHistory).toHaveBeenCalledWith(2)
    const out = await collect(res.stdout)
    expect(out.split('\n').filter(Boolean)).toHaveLength(2)
  })

  it('wait-queue returns immediately when idle', async () => {
    mocked.getQueue.mockResolvedValue({ Running: [], Pending: [] })
    const r = new CommandRegistryImpl()
    registerExecutionCommands(r)
    const res = await r.get('wait-queue')!(
      ctx(['wait-queue', '--timeout=1', '--poll=1'])
    )
    expect(res.exitCode).toBe(0)
    expect(await collect(res.stdout)).toMatch(/queue idle/)
  })

  it('wait-queue respects aborted signal', async () => {
    mocked.getQueue.mockResolvedValue({
      Running: [
        { id: 'r', status: 'in_progress', create_time: 1, priority: 0 }
      ],
      Pending: []
    })
    const ac = new AbortController()
    ac.abort()
    const r = new CommandRegistryImpl()
    registerExecutionCommands(r)
    const res = await r.get('wait-queue')!(
      ctx(['wait-queue', '--timeout=1', '--poll=1'], ac.signal)
    )
    expect(res.exitCode).toBe(130)
  })

  it('latest-output returns no history when empty', async () => {
    mocked.getHistory.mockResolvedValue([])
    const r = new CommandRegistryImpl()
    registerExecutionCommands(r)
    const res = await r.get('latest-output')!(ctx(['latest-output']))
    expect(res.exitCode).toBe(1)
    expect(res.stderr).toContain('no history')
  })

  it('latest-output emits view URLs for image outputs', async () => {
    mocked.getHistory.mockResolvedValue([
      {
        id: 'job-1',
        status: 'completed',
        create_time: 1,
        priority: 0
      }
    ])
    mocked.getJobDetail.mockResolvedValue({
      id: 'job-1',
      status: 'completed',
      create_time: 1,
      priority: 0,
      outputs: {
        '9': {
          images: [{ filename: 'out.png', subfolder: '', type: 'output' }]
        }
      }
    })
    const r = new CommandRegistryImpl()
    registerExecutionCommands(r)
    const res = await r.get('latest-output')!(ctx(['latest-output']))
    const out = await collect(res.stdout)
    expect(out).toContain('job-1')
    expect(out).toContain('/view?filename=out.png')
  })
})
