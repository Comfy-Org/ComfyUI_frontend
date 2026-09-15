import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveDistribution } from '../devserver/distributions'
import { USE_CASES } from '../useCases'
import { WORKFLOW_ASSET_EXPLANATION } from '../workflows/add'
import { runRecord } from './record'

const { autocomplete, info, path, runChecks, runCommand } = vi.hoisted(() => ({
  autocomplete: vi.fn(async () => '__add-workflow__'),
  info: vi.fn(),
  path: vi.fn(async () => {
    throw new Error('stop after file picker')
  }),
  runChecks: vi.fn(async () => ({ allPassed: true })),
  runCommand: vi.fn(() => ({ status: 0, stdout: Buffer.from('main') }))
}))

vi.mock('@clack/prompts', () => ({
  autocomplete,
  cancel: vi.fn(),
  confirm: vi.fn(),
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
})
