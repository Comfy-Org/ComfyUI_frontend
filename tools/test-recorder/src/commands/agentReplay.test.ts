import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  AGENT_REPLAY_USAGE,
  agentReplayInvocation,
  listReplayCases,
  promptAgentReplayOptions,
  runAgentReplay
} from './agentReplay'

describe('agentReplayInvocation', () => {
  it('runs the whole replay suite against the default dev server, without video', () => {
    const { args, env } = agentReplayInvocation({})
    expect(args).toEqual([
      'exec',
      'playwright',
      'test',
      'agentConversation',
      '--project=cloud'
    ])
    expect(env).toEqual({
      PLAYWRIGHT_TEST_URL: 'http://localhost:5173',
      DISTRIBUTION: 'cloud'
    })
  })

  it('narrows to one recorded case, headed, with video, on another server', () => {
    const { args, env } = agentReplayInvocation({
      caseId: 'agent-rec-add-set-delete',
      headed: true,
      video: true,
      url: 'http://127.0.0.1:6207'
    })
    expect(args.slice(-3)).toEqual([
      '-g',
      'agent-rec-add-set-delete',
      '--headed'
    ])
    expect(env.PLAYWRIGHT_TEST_URL).toBe('http://127.0.0.1:6207')
    expect(env.RECORD_VIDEO).toBe('true')
  })
})

describe('runAgentReplay', () => {
  it('prints usage for --help and spawns nothing', () => {
    const run = vi.fn()
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    expect(runAgentReplay({ help: true }, run)).toBe(0)
    expect(run).not.toHaveBeenCalled()
    expect(write).toHaveBeenCalledWith(AGENT_REPLAY_USAGE)
  })

  it('returns the suite status when it runs', () => {
    const run = vi.fn(() => ({ status: 3 }))
    expect(
      runAgentReplay({ caseId: 'agent-rec-add-set-delete' }, run as never)
    ).toBe(3)
    expect(run).toHaveBeenCalledWith(
      'pnpm',
      expect.arrayContaining(['-g', 'agent-rec-add-set-delete']),
      expect.objectContaining({
        env: expect.objectContaining({ DISTRIBUTION: 'cloud' })
      })
    )
  })
})

describe('the interactive route', () => {
  it('lists every recording by case id', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-replay-'))
    const dir = join(root, 'browser_tests/fixtures/data/agent/conversations')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'agent-rec-b.json'), '{}')
    writeFileSync(join(dir, 'agent-rec-a.json'), '{}')
    writeFileSync(join(dir, 'notes.md'), '')
    expect(listReplayCases(root)).toEqual(['agent-rec-a', 'agent-rec-b'])
  })

  it('asks for the case and whether to watch it', async () => {
    const select = vi.fn(async () => 'agent-rec-a')
    const confirm = vi.fn(async () => true)
    await expect(
      promptAgentReplayOptions(['agent-rec-a', 'agent-rec-b'], {
        select,
        confirm
      })
    ).resolves.toEqual({ caseId: 'agent-rec-a', headed: true })
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          { value: '', label: 'All recordings' },
          { value: 'agent-rec-a', label: 'agent-rec-a' },
          { value: 'agent-rec-b', label: 'agent-rec-b' }
        ]
      })
    )
  })

  it('replays every recording when "all" is chosen', async () => {
    await expect(
      promptAgentReplayOptions(['agent-rec-a'], {
        select: async () => '',
        confirm: async () => false
      })
    ).resolves.toEqual({ caseId: undefined, headed: false })
  })
})
