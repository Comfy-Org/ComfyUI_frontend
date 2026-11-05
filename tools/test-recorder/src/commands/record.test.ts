import type { AutocompleteOptions } from '@clack/prompts'
import { confirm } from '@clack/prompts'
import type { SpawnSyncReturns } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { runAgentRefactor } from '../agent/refactor'
import { detectAgentClis } from '../checks/agentCli'
import { resolveDistribution } from '../devserver/distributions'
import type { EnvInfoResult } from '../devserver/envInfo'
import { findProjectRoot, runRecording } from '../recorder/runner'
import { fail } from '../ui/logger'
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

const { autocomplete, info, path, runChecks, runCommand } = vi.hoisted(() => ({
  autocomplete: async <Value>({ options }: AutocompleteOptions<Value>) => {
    const addWorkflow = Array.isArray(options)
      ? options.find((option) => option.value === '__add-workflow__')
      : undefined
    if (!addWorkflow) throw new Error('expected the add-workflow option')
    return addWorkflow.value
  },
  info: vi.fn(),
  path: vi.fn(async () => {
    throw new Error('stop after file picker')
  }),
  runChecks: vi.fn(async () => ({ results: [], allPassed: true })),
  runCommand: vi.fn<() => SpawnSyncReturns<Buffer>>(() => commandResult())
}))

vi.mock(import('@clack/prompts'), () => ({
  autocomplete,
  cancel: vi.fn(),
  confirm: vi.fn(async () => false),
  isCancel: (value: unknown): value is symbol => typeof value === 'symbol',
  multiselect: vi.fn(),
  path,
  select: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    clear: vi.fn(),
    isCancelled: false
  })),
  text: vi.fn()
}))
vi.mock(import('./check'), () => ({ runChecks }))
vi.mock(import('../cli/run'), () => ({ runCommand }))
vi.mock(import('../devserver/envInfo'), () => ({
  fetchEnvInfo: vi.fn(async (): Promise<EnvInfoResult> => ({ ok: false }))
}))
vi.mock(import('../recorder/runner'), () => ({
  findProjectRoot: vi.fn(() => '/project'),
  listWorkflows: vi.fn(() => ['default']),
  runRecording: vi.fn()
}))
vi.mock(import('../devserver/manager'), () => ({
  ensureDevServer: vi.fn(async () => ({
    url: 'http://localhost:5173',
    ownedByUs: true,
    reused: false,
    stop: vi.fn()
  }))
}))
vi.mock(import('../checks/agentCli'), () => ({
  detectAgentClis: vi.fn(() => [])
}))
vi.mock(import('../agent/refactor'), () => ({
  runAgentRefactor: vi.fn()
}))
vi.mock(import('../ui/logger'), () => ({
  alert: vi.fn(),
  blank: vi.fn(),
  box: vi.fn(),
  fail: vi.fn(),
  info,
  pass: vi.fn(),
  warn: vi.fn()
}))
vi.mock(import('../ui/steps'), () => ({ stepHeader: vi.fn() }))

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

  it('stops before the file picker when a prefilled PR cannot be verified', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true
    })
    runCommand.mockReset()
    runCommand.mockReturnValueOnce(
      commandResult({ error: new Error('gh is unavailable'), status: 1 })
    )
    vi.mocked(confirm).mockResolvedValueOnce(false)

    await expect(runRecord({ pr: '123', warnings: [] })).rejects.toThrow(
      'PR #123 checkout was not verified'
    )

    expect(path).not.toHaveBeenCalled()
  })

  it('fails closed when a prefilled PR cannot be verified', async () => {
    runCommand.mockReset()
    runCommand.mockReturnValueOnce(
      commandResult({ error: new Error('gh is unavailable'), status: 1 })
    )
    vi.mocked(confirm).mockResolvedValueOnce(false)

    await expect(preparePrCheckout('123', '/project')).rejects.toThrow(
      'PR #123 checkout was not verified'
    )
    expect(confirm).not.toHaveBeenCalled()
  })

  it('fails closed when an interactive fallback is declined', async () => {
    runCommand.mockReset()
    runCommand.mockReturnValueOnce(
      commandResult({ error: new Error('gh is unavailable'), status: 1 })
    )
    vi.mocked(confirm).mockResolvedValueOnce(false)

    await expect(
      preparePrCheckout('123', '/project', { allowExplicitFallback: true })
    ).rejects.toThrow('PR #123 checkout was not verified')
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
    vi.mocked(confirm).mockResolvedValueOnce(true)

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

  it('returns the detached revision when an interactive fallback is explicit', async () => {
    runCommand.mockReset()
    runCommand
      .mockReturnValueOnce(
        commandResult({ error: new Error('gh is unavailable'), status: 1 })
      )
      .mockReturnValueOnce(commandResult())
      .mockReturnValueOnce(
        commandResult({ stdout: Buffer.from('detached123\n') })
      )
    vi.mocked(confirm).mockResolvedValueOnce(true)

    await expect(
      preparePrCheckout('123', '/project', { allowExplicitFallback: true })
    ).resolves.toEqual({
      requestedBranch: '',
      requestedHead: '',
      effectiveBranch: '',
      effectiveHead: 'detached123',
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

  it('switches to a confirmed PR checkout from a detached HEAD', async () => {
    runCommand.mockReset()
    runCommand
      .mockReturnValueOnce(
        commandResult({
          stdout: Buffer.from('feature\tabc123\tFeature\tOPEN\n')
        })
      )
      .mockReturnValueOnce(commandResult())
      .mockReturnValueOnce(
        commandResult({ stdout: Buffer.from('detached456\n') })
      )
      .mockReturnValueOnce(commandResult())
      .mockReturnValueOnce(commandResult())
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('feature\n') }))
      .mockReturnValueOnce(commandResult({ stdout: Buffer.from('abc123\n') }))
    vi.mocked(confirm).mockResolvedValueOnce(true)

    await expect(preparePrCheckout('123', '/project')).resolves.toEqual({
      requestedBranch: 'feature',
      requestedHead: 'abc123',
      effectiveBranch: 'feature',
      effectiveHead: 'abc123',
      mode: 'verified'
    })
    expect(confirm).toHaveBeenCalledWith({
      message: 'Switch to the code for PR #123?'
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
    vi.mocked(confirm).mockResolvedValueOnce(true).mockResolvedValueOnce(false)

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
    vi.mocked(confirm).mockResolvedValueOnce(true).mockResolvedValueOnce(false)

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
    vi.mocked(confirm).mockResolvedValueOnce(true)

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
    vi.mocked(confirm).mockResolvedValueOnce(false)

    await expect(preparePrCheckout('123', '/project')).rejects.toThrow(
      'PR #123 checkout was not verified'
    )
    expect(confirm).toHaveBeenCalledWith({
      message: 'Switch to the code for PR #123?'
    })
  })
})

const EXISTING_SPEC = '// a committed spec somebody else wrote\n'
const RECORDED_CODE =
  "await page.getByText('Queue').click();\n" +
  "await expect(page.getByText('Queue')).toBeVisible();\n"

function seedMissingSpec(slug: string) {
  const root = mkdtempSync(join(tmpdir(), 'comfy-record-'))
  const testsDir = join(root, 'browser_tests', 'tests')
  mkdirSync(testsDir, { recursive: true })
  vi.mocked(findProjectRoot).mockReturnValue(root)
  return { root, outputPath: join(testsDir, `${slug}.spec.ts`) }
}

function seedExistingSpec(slug: string) {
  const seeded = seedMissingSpec(slug)
  writeFileSync(seeded.outputPath, EXISTING_SPEC)
  return seeded
}

function prefillFor(slug: string) {
  return {
    distribution: resolveDistribution('local'),
    useCase: USE_CASES[0],
    description: slug,
    name: slug,
    tags: [],
    workflow: '',
    featureFlags: {},
    warnings: []
  }
}

const overwritePrompt = expect.objectContaining({
  message: expect.stringContaining('Overwrite it?')
})

const refactorOrPrPrompt = expect.objectContaining({
  message: expect.stringMatching(/refactor|Pull Request/)
})

function overwriteQuestions() {
  return vi
    .mocked(confirm)
    .mock.calls.filter(([options]) => overwritePrompt.asymmetricMatch(options))
}

function answerOverwriteWith(answer: boolean | symbol) {
  vi.mocked(confirm).mockResolvedValue(true)
  vi.when(vi.mocked(confirm)).calledWith(overwritePrompt).thenResolve(answer)
  vi.when(vi.mocked(confirm)).calledWith(refactorOrPrPrompt).thenResolve(false)
}

describe('runRecord overwrite guard', () => {
  it.for([
    { outcome: 'declined', answer: false, expectedExitCode: 1 },
    {
      outcome: 'cancelled',
      answer: Symbol('clack:cancel'),
      expectedExitCode: 0
    }
  ])(
    'keeps the existing spec when the overwrite prompt is $outcome',
    async ({ outcome, answer, expectedExitCode }) => {
      Object.defineProperty(process.stdin, 'isTTY', {
        configurable: true,
        value: true
      })
      const slug = `${outcome}-overwrite`
      const { root, outputPath } = seedExistingSpec(slug)
      try {
        vi.mocked(runRecording).mockResolvedValue({
          success: true,
          recordedCode: RECORDED_CODE
        })
        answerOverwriteWith(answer)
        vi.spyOn(process, 'exit').mockImplementation((code) => {
          throw new Error(`exit:${code}`)
        })

        await expect(runRecord(prefillFor(slug))).rejects.toThrow(
          `exit:${expectedExitCode}`
        )

        expect(confirm).toHaveBeenCalledWith(overwritePrompt)
        expect(runRecording).not.toHaveBeenCalled()
        expect(readFileSync(outputPath, 'utf-8')).toBe(EXISTING_SPEC)
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }
  )

  it.for([
    {
      outcome: 'accepted at the prompt',
      force: undefined,
      answer: true,
      expectedOverwriteQuestions: 1
    },
    {
      outcome: 'skipped by --force',
      force: true,
      answer: false,
      expectedOverwriteQuestions: 0
    }
  ])(
    'replaces the existing spec when overwrite is $outcome',
    async ({ outcome, force, answer, expectedOverwriteQuestions }) => {
      Object.defineProperty(process.stdin, 'isTTY', {
        configurable: true,
        value: true
      })
      const slug = `${outcome.replaceAll(' ', '-')}-overwrite`
      const { root, outputPath } = seedExistingSpec(slug)
      try {
        vi.mocked(runRecording).mockResolvedValue({
          success: true,
          recordedCode: RECORDED_CODE
        })
        answerOverwriteWith(answer)
        vi.spyOn(process, 'exit').mockImplementation((code) => {
          throw new Error(`exit:${code}`)
        })

        await runRecord({ ...prefillFor(slug), force })

        expect(overwriteQuestions()).toHaveLength(expectedOverwriteQuestions)
        expect(readFileSync(outputPath, 'utf-8')).toContain(
          "comfyPage.page.getByText('Queue').click()"
        )
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }
  )

  it('saves a recording to a destination that does not exist yet', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true
    })
    const { root, outputPath } = seedMissingSpec('fresh-destination')
    try {
      vi.mocked(runRecording).mockResolvedValue({
        success: true,
        recordedCode: RECORDED_CODE
      })
      answerOverwriteWith(false)
      vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`exit:${code}`)
      })

      await runRecord(prefillFor('fresh-destination'))

      expect(overwriteQuestions()).toHaveLength(0)
      expect(readFileSync(outputPath, 'utf-8')).toContain(
        "comfyPage.page.getByText('Queue').click()"
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('refuses a dangling symlink destination instead of writing through it', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true
    })
    const { root, outputPath } = seedMissingSpec('dangling-destination')
    const linkTarget = join(root, 'outside-the-tests-dir.spec.ts')
    try {
      symlinkSync(linkTarget, outputPath)
      vi.mocked(runRecording).mockResolvedValue({
        success: true,
        recordedCode: RECORDED_CODE
      })
      answerOverwriteWith(true)
      vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`exit:${code}`)
      })

      await expect(
        runRecord(prefillFor('dangling-destination'))
      ).rejects.toThrow('exit:1')

      expect(existsSync(linkTarget)).toBe(false)
      expect(fail).toHaveBeenCalledWith(
        'Refusing to overwrite existing test',
        expect.stringContaining(outputPath)
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('replaces a live symlink without changing its target when forced', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true
    })
    const { root, outputPath } = seedMissingSpec('linked-destination')
    const linkTarget = join(root, 'outside-the-tests-dir.spec.ts')
    try {
      writeFileSync(linkTarget, EXISTING_SPEC)
      symlinkSync(linkTarget, outputPath)
      vi.mocked(runRecording).mockResolvedValue({
        success: true,
        recordedCode: RECORDED_CODE
      })
      answerOverwriteWith(false)
      vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`exit:${code}`)
      })

      await runRecord({ ...prefillFor('linked-destination'), force: true })

      expect(readFileSync(linkTarget, 'utf-8')).toBe(EXISTING_SPEC)
      expect(readFileSync(outputPath, 'utf-8')).toContain(
        "comfyPage.page.getByText('Queue').click()"
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('refuses a late collision without prompting when stdin closed at EOF during the paste', async () => {
    const { root, outputPath } = seedMissingSpec('eof-overwrite')
    const stdinDescriptor = Object.getOwnPropertyDescriptors(process).stdin
    try {
      vi.mocked(runRecording).mockImplementation(async () => {
        writeFileSync(outputPath, EXISTING_SPEC)
        return {
          success: true,
          recordedCode: ''
        }
      })
      vi.mocked(confirm).mockImplementation(async () => true)
      const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`exit:${code}`)
      })

      const fakeStdin = Readable.from([RECORDED_CODE])
      Object.defineProperty(fakeStdin, 'isTTY', {
        configurable: true,
        value: true
      })
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        value: fakeStdin
      })

      await expect(runRecord(prefillFor('eof-overwrite'))).rejects.toThrow(
        'exit:1'
      )

      expect(confirm).not.toHaveBeenCalledWith(overwritePrompt)
      expect(readFileSync(outputPath, 'utf-8')).toBe(EXISTING_SPEC)
      expect(exit).toHaveBeenCalledWith(1)
      expect(fail).toHaveBeenCalledWith(
        'Refusing to overwrite existing test',
        expect.stringContaining('stdin is closed')
      )
    } finally {
      Object.defineProperty(process, 'stdin', stdinDescriptor)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('replaces with --force after EOF without prompting for anything', async () => {
    const { root, outputPath } = seedExistingSpec('eof-force')
    const stdinDescriptor = Object.getOwnPropertyDescriptors(process).stdin
    try {
      vi.mocked(runRecording).mockResolvedValue({
        success: true,
        recordedCode: ''
      })
      vi.mocked(detectAgentClis).mockReturnValueOnce([
        { label: 'Claude Code', command: 'claude', buildArgs: () => [] }
      ])
      vi.mocked(confirm).mockImplementation(async () => true)
      const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`exit:${code}`)
      })

      const fakeStdin = Readable.from([RECORDED_CODE])
      Object.defineProperty(fakeStdin, 'isTTY', {
        configurable: true,
        value: true
      })
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        value: fakeStdin
      })

      await runRecord({ ...prefillFor('eof-force'), force: true })

      expect(readFileSync(outputPath, 'utf-8')).toContain(
        "comfyPage.page.getByText('Queue').click()"
      )
      expect(confirm).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('refactor')
        })
      )
      expect(runAgentRefactor).not.toHaveBeenCalled()
      expect(exit).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(process, 'stdin', stdinDescriptor)
      rmSync(root, { recursive: true, force: true })
    }
  })
})
