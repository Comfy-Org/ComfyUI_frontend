import type { AutocompleteOptions } from '@clack/prompts'
import type { SpawnSyncReturns } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveDistribution } from '../devserver/distributions'
import type { EnvInfoResult } from '../devserver/envInfo'
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
  runCommand: vi.fn(
    (): SpawnSyncReturns<Buffer> => ({
      pid: 1,
      output: [],
      stdout: Buffer.from('main'),
      stderr: Buffer.alloc(0),
      status: 0,
      signal: null
    })
  )
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
