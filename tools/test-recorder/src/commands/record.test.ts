import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SpawnSyncReturns } from 'node:child_process'

import { resolveDistribution } from '../devserver/distributions'
import { USE_CASES } from '../useCases'
import { WORKFLOW_ASSET_EXPLANATION } from '../workflows/add'
import { preparePrCheckout, runRecord } from './record'

function commandResult(
  overrides: Partial<SpawnSyncReturns<Buffer>> = {}
): SpawnSyncReturns<Buffer> {
  return {
    pid: 0,
    output: [Buffer.from('')],
    stdout: Buffer.from(''),
    stderr: Buffer.from(''),
    status: 0,
    signal: null,
    ...overrides
  }
}

const { autocomplete, confirm, info, path, runChecks, runCommand } = vi.hoisted(
  () => ({
    autocomplete: vi.fn(async () => '__add-workflow__'),
    confirm: vi.fn(async () => false),
    info: vi.fn(),
    path: vi.fn(async () => {
      throw new Error('stop after file picker')
    }),
    runChecks: vi.fn(async () => ({ allPassed: true })),
    runCommand: vi.fn<() => SpawnSyncReturns<Buffer>>(() => commandResult())
  })
)

vi.mock('@clack/prompts', () => ({
  autocomplete,
  cancel: vi.fn(),
  confirm,
  isCancel: vi.fn(() => false),
  multiselect: vi.fn(),
  path,
  select: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  text: vi.fn()
}))
vi.mock('./check', () => ({ runChecks }))
vi.mock('../cli/run', () => ({ runCommand }))
vi.mock('../devserver/envInfo', () => ({
  fetchEnvInfo: vi.fn(async () => ({ ok: false }))
}))
vi.mock('../recorder/runner', () => ({
  findProjectRoot: vi.fn(() => '/project'),
  listWorkflows: vi.fn(() => ['default']),
  runRecording: vi.fn()
}))
vi.mock('../ui/logger', () => ({
  alert: vi.fn(),
  blank: vi.fn(),
  box: vi.fn(),
  fail: vi.fn(),
  info,
  pass: vi.fn(),
  warn: vi.fn()
}))
vi.mock('../ui/steps', () => ({ stepHeader: vi.fn() }))

const originalIsTTY = process.stdin.isTTY

afterEach(() => {
  Object.defineProperty(process.stdin, 'isTTY', {
    configurable: true,
    value: originalIsTTY
  })
})

describe('runRecord', () => {
  it('explains workflow portability before opening the file picker', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true
    })
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)
    path.mockImplementationOnce(async () => {
      expect(info).toHaveBeenCalledWith([WORKFLOW_ASSET_EXPLANATION])
      throw new Error('stop after file picker')
    })

    await expect(
      runRecord({
        distribution: resolveDistribution('local'),
        useCase: USE_CASES[0],
        description: 'workflow portability',
        name: 'workflow-portability',
        tags: [],
        warnings: []
      })
    ).rejects.toThrow('stop after file picker')

    expect(info).toHaveBeenCalledWith([WORKFLOW_ASSET_EXPLANATION])
    expect(exit).not.toHaveBeenCalled()
  })

  it('fails closed when a prefilled PR cannot be verified', async () => {
    runCommand.mockReset()
    runCommand.mockReturnValueOnce(
      commandResult({ error: new Error('gh is unavailable'), status: 1 })
    )
    confirm.mockResolvedValueOnce(false)

    await expect(preparePrCheckout('123', '/project')).rejects.toThrow(
      'PR #123 checkout was not verified'
    )
  })

  it('fails closed without prompting when explicit fallback is disabled', async () => {
    runCommand.mockReset()
    runCommand.mockReturnValueOnce(
      commandResult({ error: new Error('gh is unavailable'), status: 1 })
    )

    await expect(
      preparePrCheckout('123', '/project', { allowExplicitFallback: false })
    ).rejects.toThrow('PR #123 checkout was not verified')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('returns the effective revision when an interactive fallback is explicit', async () => {
    runCommand.mockReset()
    runCommand
      .mockReturnValueOnce(
        commandResult({ error: new Error('gh is unavailable'), status: 1 })
      )
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('main\n') }))
      .mockReturnValueOnce(
        commandResult({ stdout: Buffer.from('effective123\n') })
      )
    confirm.mockResolvedValueOnce(true)

    await expect(
      preparePrCheckout('123', '/project', { allowExplicitFallback: true })
    ).resolves.toEqual({
      requestedBranch: '',
      requestedHead: '',
      effectiveBranch: 'main',
      effectiveHead: 'effective123',
      mode: 'explicit-fallback'
    })
  })

  it('records the requested and effective revision when a PR checkout matches', async () => {
    runCommand.mockReset()
    runCommand
      .mockReturnValueOnce(
        commandResult({
          stdout: Buffer.from('feature\tabc123\tFeature\tOPEN\n')
        })
      )
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('feature\n') }))
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('abc123\n') }))
      .mockReturnValueOnce(commandResult())

    await expect(preparePrCheckout('123', '/project')).resolves.toEqual({
      requestedBranch: 'feature',
      requestedHead: 'abc123',
      effectiveBranch: 'feature',
      effectiveHead: 'abc123',
      mode: 'verified'
    })
  })

  it('fails closed when the confirmed PR checkout fails', async () => {
    runCommand.mockReset()
    runCommand
      .mockReturnValueOnce(
        commandResult({
          stdout: Buffer.from('feature\tabc123\tFeature\tOPEN\n')
        })
      )
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('main\n') }))
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('old456\n') }))
      .mockReturnValueOnce(commandResult())
      .mockReturnValueOnce(
        commandResult({ error: new Error('checkout failed'), status: 1 })
      )
    confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    await expect(preparePrCheckout('123', '/project')).rejects.toThrow(
      'PR #123 checkout was not verified'
    )
  })

  it('fails closed when a confirmed checkout has the wrong effective branch', async () => {
    runCommand.mockReset()
    runCommand
      .mockReturnValueOnce(
        commandResult({
          stdout: Buffer.from('feature\tabc123\tFeature\tOPEN\n')
        })
      )
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('main\n') }))
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('old456\n') }))
      .mockReturnValueOnce(commandResult())
      .mockReturnValueOnce(commandResult())
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('other\n') }))
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('abc123\n') }))
    confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    await expect(preparePrCheckout('123', '/project')).rejects.toThrow(
      'PR #123 checkout was not verified'
    )
  })

  it('returns verified after a confirmed checkout matches both revisions', async () => {
    runCommand.mockReset()
    runCommand
      .mockReturnValueOnce(
        commandResult({
          stdout: Buffer.from('feature\tabc123\tFeature\tOPEN\n')
        })
      )
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('main\n') }))
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('old456\n') }))
      .mockReturnValueOnce(commandResult())
      .mockReturnValueOnce(commandResult())
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('feature\n') }))
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('abc123\n') }))
    confirm.mockResolvedValueOnce(true)

    await expect(preparePrCheckout('123', '/project')).resolves.toEqual({
      requestedBranch: 'feature',
      requestedHead: 'abc123',
      effectiveBranch: 'feature',
      effectiveHead: 'abc123',
      mode: 'verified'
    })
  })

  it('fails closed when the current branch probe fails', async () => {
    runCommand.mockReset()
    runCommand
      .mockReturnValueOnce(
        commandResult({
          stdout: Buffer.from('feature\tabc123\tFeature\tOPEN\n')
        })
      )
      .mockReturnValueOnce(
        commandResult({ error: new Error('branch probe failed'), status: 1 })
      )

    await expect(preparePrCheckout('123', '/project')).rejects.toThrow(
      'git branch --show-current failed'
    )
    expect(confirm).not.toHaveBeenCalled()
  })

  it('does not treat a stale same-branch checkout as the requested PR', async () => {
    runCommand.mockReset()
    runCommand
      .mockReturnValueOnce(
        commandResult({
          stdout: Buffer.from('feature\tabc123\tFeature\tOPEN\n')
        })
      )
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('feature\n') }))
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('old456\n') }))
      .mockReturnValueOnce(commandResult())
    confirm.mockResolvedValueOnce(false)

    await expect(preparePrCheckout('123', '/project')).rejects.toThrow(
      'PR #123 checkout was not verified'
    )
    expect(confirm).toHaveBeenCalledWith({
      message: 'Switch to the code for PR #123?'
    })
  })
})
