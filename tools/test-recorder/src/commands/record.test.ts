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
import { runRecord } from './record'

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
  runCommand: vi.fn((): SpawnSyncReturns<Buffer> => ({
    pid: 1,
    output: [],
    stdout: Buffer.from('main'),
    stderr: Buffer.alloc(0),
    status: 0,
    signal: null
  }))
}))

vi.mock(import('@clack/prompts'), () => ({
  autocomplete,
  cancel: vi.fn(),
  confirm: vi.fn(),
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

const overwriteQuestions = () =>
  vi
    .mocked(confirm)
    .mock.calls.filter(([options]) => options.message.includes('Overwrite it?'))

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

  it('refuses without prompting when stdin closed at EOF during the paste', async () => {
    const { root, outputPath } = seedExistingSpec('eof-overwrite')
    const stdinDescriptor = Object.getOwnPropertyDescriptor(process, 'stdin')!
    try {
      vi.mocked(runRecording).mockResolvedValue({
        success: true,
        recordedCode: ''
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
    const stdinDescriptor = Object.getOwnPropertyDescriptor(process, 'stdin')!
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
