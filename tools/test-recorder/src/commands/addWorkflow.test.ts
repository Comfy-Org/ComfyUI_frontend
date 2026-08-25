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

    runAddWorkflow(sourcePath)

    expect(log).toHaveBeenNthCalledWith(1, 'example')
    expect(log).toHaveBeenNthCalledWith(
      2,
      'This workflow is copied into shared test assets so automated runs on other machines can use it. Personal files that are not added this way will not work there.'
    )
    expect(log).toHaveBeenNthCalledWith(2, WORKFLOW_ASSET_EXPLANATION)
  })
})
