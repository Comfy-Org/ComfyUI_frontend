import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../pr/openPr', () => ({ openPr: vi.fn() }))
vi.mock('../recorder/runner', () => ({
  findProjectRoot: vi.fn()
}))

import { openPr } from '../pr/openPr'
import { findProjectRoot } from '../recorder/runner'
import { runPr } from './pr'

describe('runPr', () => {
  let projectRoot: string
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'comfy-test-pr-'))
    mkdirSync(join(projectRoot, 'browser_tests', 'tests'), { recursive: true })
    vi.mocked(findProjectRoot).mockReturnValue(projectRoot)
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('opens a PR for a spec under browser_tests/tests/', async () => {
    const file = join(projectRoot, 'browser_tests', 'tests', 'foo.spec.ts')
    writeFileSync(file, '')

    await runPr(file, 'desc')

    expect(openPr).toHaveBeenCalledWith(
      expect.objectContaining({ testFilePath: file, testName: 'foo' })
    )
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('refuses an untransformed .raw.spec.ts file', async () => {
    const file = join(projectRoot, 'browser_tests', 'tests', 'foo.raw.spec.ts')
    writeFileSync(file, '')

    await expect(runPr(file)).rejects.toThrow('process.exit called')

    expect(openPr).not.toHaveBeenCalled()
  })

  it('refuses a spec outside browser_tests/tests/', async () => {
    const dir = join(projectRoot, 'browser_tests', 'fixtures')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'helper.spec.ts')
    writeFileSync(file, '')

    await expect(runPr(file)).rejects.toThrow('process.exit called')

    expect(openPr).not.toHaveBeenCalled()
  })

  it('refuses a file that is not a .spec.ts', async () => {
    const file = join(projectRoot, 'browser_tests', 'tests', 'foo.ts')
    writeFileSync(file, '')

    await expect(runPr(file)).rejects.toThrow('process.exit called')

    expect(openPr).not.toHaveBeenCalled()
  })

  it('refuses a file that does not exist', async () => {
    const file = join(projectRoot, 'browser_tests', 'tests', 'missing.spec.ts')

    await expect(runPr(file)).rejects.toThrow('process.exit called')

    expect(openPr).not.toHaveBeenCalled()
  })
})
