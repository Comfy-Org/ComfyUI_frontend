import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { runCommand } from '../cli/run'
import {
  AGENT_REPLAY_USAGE,
  agentReplayCli,
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
      '(^|\\s)recorded agent-rec-add-set-delete(\\s|$)',
      '--headed'
    ])
    const grep = new RegExp(args.at(-2)!)
    const title = (caseId: string) =>
      `cloud agentConversationReplay.spec.ts Agent conversation replay recorded ${caseId} replays every recorded turn onto the panel and the canvas`
    expect(grep.test(title('agent-rec-add-set-delete'))).toBe(true)
    expect(grep.test(title('prefix-agent-rec-add-set-delete'))).toBe(false)
    expect(grep.test(title('agent-rec-add-set-delete.retry'))).toBe(false)
    expect(grep.test(title('agent-rec-add-set-delete-2'))).toBe(false)
    expect(env.PLAYWRIGHT_TEST_URL).toBe('http://127.0.0.1:6207')
    expect(env.RECORD_VIDEO).toBe('true')
  })
})

describe('runAgentReplay', () => {
  it('returns the suite status when it runs', () => {
    const run = vi.fn(() => ({ status: 3 }))
    expect(runAgentReplay({ caseId: 'agent-rec-add-set-delete' }, run)).toBe(3)
    expect(run).toHaveBeenCalledWith(
      'pnpm',
      expect.arrayContaining([
        '-g',
        '(^|\\s)recorded agent-rec-add-set-delete(\\s|$)'
      ]),
      expect.objectContaining({
        env: expect.objectContaining({ DISTRIBUTION: 'cloud' })
      })
    )
  })
})

describe('the interactive route', () => {
  it('lists every recording by case id', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-replay-'))
    try {
      const dir = join(root, 'browser_tests/fixtures/data/agent/conversations')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'agent-rec-b.json'), '{}')
      writeFileSync(join(dir, 'agent-rec-a.json'), '{}')
      writeFileSync(join(dir, 'notes.md'), '')
      expect(listReplayCases(root)).toEqual(['agent-rec-a', 'agent-rec-b'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
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

describe('agentReplayCli', () => {
  it('prints the usage for --help and spawns nothing', async () => {
    const run = vi.fn(() => ({ status: 0 }))
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    await expect(agentReplayCli(['--help'], { run })).resolves.toBe(0)
    expect(run).not.toHaveBeenCalled()
    expect(out).toHaveBeenCalledWith(AGENT_REPLAY_USAGE)
  })

  it.for([['--case'], ['--url'], ['--case', '--headed']])(
    'refuses %s without a value before spawning',
    async (argv) => {
      const run = vi.fn(() => ({ status: 0 }))
      const err = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true)
      await expect(
        agentReplayCli(argv, { run, interactive: true })
      ).resolves.toBe(1)
      expect(run).not.toHaveBeenCalled()
      expect(err).toHaveBeenCalledWith(
        expect.stringContaining(`${argv[0]} needs a value`)
      )
    }
  )

  it.for([['--bogus'], ['stray'], ['--case', 'agent-rec-a', 'stray']])(
    'refuses the unknown argument in %s before spawning',
    async (argv) => {
      const run = vi.fn(() => ({ status: 0 }))
      const err = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true)
      await expect(
        agentReplayCli(argv, { run, cases: () => ['agent-rec-a'] })
      ).resolves.toBe(1)
      expect(run).not.toHaveBeenCalled()
      expect(err).toHaveBeenCalledWith(
        expect.stringContaining(`unknown argument ${argv.at(-1)}`)
      )
    }
  )

  it.for(['--video=false', '--headed=false', '--help=1'])(
    'refuses a value on %s before spawning',
    async (flag) => {
      const run = vi.fn(() => ({ status: 0 }))
      const err = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true)
      await expect(
        agentReplayCli(['--case', 'agent-rec-a', flag], {
          run,
          cases: () => ['agent-rec-a']
        })
      ).resolves.toBe(1)
      expect(run).not.toHaveBeenCalled()
      expect(err).toHaveBeenCalledWith(
        expect.stringContaining(`${flag.split('=')[0]} takes no value`)
      )
    }
  )

  it.for([['agent-rec'], ['agent-rec-c']])(
    'refuses %s, which names no recording, before spawning',
    async ([caseId]) => {
      const run = vi.fn(() => ({ status: 0 }))
      const err = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true)
      await expect(
        agentReplayCli(['--case', caseId], {
          run,
          cases: () => ['agent-rec-a', 'agent-rec-b']
        })
      ).resolves.toBe(1)
      expect(run).not.toHaveBeenCalled()
      expect(err).toHaveBeenCalledWith(
        `no recording named ${caseId}; recordings: agent-rec-a, agent-rec-b\n`
      )
    }
  )

  it('runs the flags without prompting, even on a terminal', async () => {
    const run = vi.fn(() => ({ status: 2 }))
    const select = vi.fn(async () => '')
    await expect(
      agentReplayCli(['--case', 'agent-rec-a', '--video'], {
        run,
        interactive: true,
        cases: () => ['agent-rec-a'],
        prompts: { select, confirm: async () => false }
      })
    ).resolves.toBe(2)
    expect(select).not.toHaveBeenCalled()
    expect(run).toHaveBeenCalledWith(
      'pnpm',
      expect.arrayContaining(['-g', '(^|\\s)recorded agent-rec-a(\\s|$)']),
      expect.objectContaining({
        env: expect.objectContaining({ RECORD_VIDEO: 'true' })
      })
    )
  })

  it('replays every recording without prompting off a terminal', async () => {
    const run = vi.fn(() => ({ status: 0 }))
    const select = vi.fn(async () => '')
    await expect(
      agentReplayCli([], {
        run,
        interactive: false,
        prompts: { select, confirm: async () => false }
      })
    ).resolves.toBe(0)
    expect(select).not.toHaveBeenCalled()
    expect(run).toHaveBeenCalledWith(
      'pnpm',
      expect.not.arrayContaining(['-g']),
      expect.anything()
    )
  })

  it('asks on a terminal with no flags and runs the chosen recording', async () => {
    const run = vi.fn(() => ({ status: 0 }))
    await expect(
      agentReplayCli([], {
        run,
        interactive: true,
        cases: () => ['agent-rec-a', 'agent-rec-b'],
        prompts: {
          select: async () => 'agent-rec-b',
          confirm: async () => true
        }
      })
    ).resolves.toBe(0)
    expect(run).toHaveBeenCalledWith(
      'pnpm',
      expect.arrayContaining([
        '-g',
        '(^|\\s)recorded agent-rec-b(\\s|$)',
        '--headed'
      ]),
      expect.anything()
    )
  })
})

describe('the comfy-test entry', () => {
  it('routes agent-replay --help to the usage', { timeout: 60_000 }, () => {
    const result = runCommand('pnpm', [
      'exec',
      'tsx',
      'tools/test-recorder/src/index.ts',
      'agent-replay',
      '--help'
    ])
    expect(result.status).toBe(0)
    expect(String(result.stdout)).toContain('Usage: comfy-test agent-replay')
  })
})
