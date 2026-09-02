import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WORKFLOW_ASSET_EXPLANATION } from '../workflows/add'
import { runAddWorkflow } from './addWorkflow'

const { findProjectRoot } = vi.hoisted(() => ({
  findProjectRoot: vi.fn()
}))

vi.mock('../recorder/runner', () => ({ findProjectRoot }))

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
  tempDirs.length = 0
})

describe('runAddWorkflow', () => {
  it('explains why the workflow is copied into shared test assets', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'comfy-workflow-command-'))
    tempDirs.push(projectRoot)
    mkdirSync(join(projectRoot, 'browser_tests', 'assets'), {
      recursive: true
    })
    const sourcePath = join(projectRoot, 'example.json')
    writeFileSync(sourcePath, '{"nodes":[]}')
    findProjectRoot.mockReturnValue(projectRoot)
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    runAddWorkflow(sourcePath)

    expect(log).toHaveBeenCalledOnce()
    expect(log).toHaveBeenCalledWith('example')
    expect(error).toHaveBeenCalledWith(WORKFLOW_ASSET_EXPLANATION)
  })
})
