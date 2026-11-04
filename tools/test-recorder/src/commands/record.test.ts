import type { AutocompleteOptions } from '@clack/prompts'
import type { SpawnSyncReturns } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveDistribution } from '../devserver/distributions'
import type { EnvInfoResult } from '../devserver/envInfo'
import { USE_CASES } from '../useCases'
import { WORKFLOW_ASSET_EXPLANATION } from '../workflows/add'
import { runRecord } from './record'

const {
  autocomplete,
  info,
  path,
  runChecks,
  runCommand,
  confirm,
  fail,
  findProjectRoot,
  runRecording,
  ensureDevServer
} = vi.hoisted(() => ({
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
  })),
  confirm: vi.fn(),
  fail: vi.fn(),
  findProjectRoot: vi.fn(() => '/project'),
  runRecording: vi.fn(),
  ensureDevServer: vi.fn(async () => ({
    url: 'http://localhost:5173',
    ownedByUs: true,
    reused: false,
    stop: vi.fn()
  }))
}))

vi.mock(import('@clack/prompts'), () => ({
  autocomplete,
  cancel: vi.fn(),
  confirm,
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
  findProjectRoot,
  listWorkflows: vi.fn(() => ['default']),
  runRecording
}))
vi.mock(import('../devserver/manager'), () => ({ ensureDevServer }))
vi.mock(import('../ui/logger'), () => ({
  alert: vi.fn(),
  blank: vi.fn(),
  box: vi.fn(),
  fail,
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

/**
 * The overwrite guard sits behind the whole guided flow, so these drive
 * `runRecord` with a complete prefill against a real temp checkout — every
 * prompt before step 6 is answered by the prefill rather than mocked away.
 */
function seedExistingSpec(slug: string) {
  const root = mkdtempSync(join(tmpdir(), 'comfy-record-'))
  const testsDir = join(root, 'browser_tests', 'tests')
  mkdirSync(testsDir, { recursive: true })
  const outputPath = join(testsDir, `${slug}.spec.ts`)
  writeFileSync(outputPath, EXISTING_SPEC)
  findProjectRoot.mockReturnValue(root)
  return { root, outputPath }
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

describe('runRecord overwrite guard', () => {
  it('leaves the existing spec alone when the overwrite prompt is declined', async () => {
    vi.clearAllMocks()
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true
    })
    const { root, outputPath } = seedExistingSpec('decline-overwrite')
    try {
      runRecording.mockResolvedValue({
        success: true,
        recordedCode: RECORDED_CODE
      })
      confirm.mockImplementation(async ({ message }: { message: string }) =>
        message.includes('Overwrite it?') ? false : true
      )
      const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`exit:${code}`)
      })

      await expect(runRecord(prefillFor('decline-overwrite'))).rejects.toThrow(
        'exit:1'
      )

      expect(confirm).toHaveBeenCalledWith(overwritePrompt)
      expect(readFileSync(outputPath, 'utf-8')).toBe(EXISTING_SPEC)
      expect(exit).toHaveBeenCalledWith(1)
      expect(fail).toHaveBeenCalledWith(
        'Refusing to overwrite existing test',
        expect.any(String)
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('refuses without prompting when stdin closed at EOF during the paste', async () => {
    vi.clearAllMocks()
    const { root, outputPath } = seedExistingSpec('eof-overwrite')
    const realStdin = process.stdin
    try {
      // No automatic capture, so runRecord falls back to the manual paste.
      runRecording.mockResolvedValue({ success: true, recordedCode: '' })
      // Answers yes to anything, so a surviving overwrite prompt would
      // clobber the seeded spec rather than quietly pass.
      confirm.mockImplementation(async () => true)
      const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`exit:${code}`)
      })

      // Ends the paste with EOF rather than the "." sentinel, which is what
      // closes stdin for every later prompt.
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

      // The regression: prompting here hangs, so the guard must refuse first.
      expect(confirm).not.toHaveBeenCalledWith(overwritePrompt)
      expect(readFileSync(outputPath, 'utf-8')).toBe(EXISTING_SPEC)
      expect(exit).toHaveBeenCalledWith(1)
      expect(fail).toHaveBeenCalledWith(
        'Refusing to overwrite existing test',
        expect.stringContaining('stdin is closed')
      )
    } finally {
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        value: realStdin
      })
      rmSync(root, { recursive: true, force: true })
    }
  })
})
