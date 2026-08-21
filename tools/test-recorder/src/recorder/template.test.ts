import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cleanupRecordingTemplate, generateRecordingTemplate } from './template'

describe('recording template', () => {
  let browserTestsDir: string

  beforeEach(() => {
    browserTestsDir = mkdtempSync(join(tmpdir(), 'recording-'))
  })

  afterEach(() => {
    rmSync(browserTestsDir, { recursive: true, force: true })
  })

  function generate(options: { testName: string; workflow?: string }) {
    const path = generateRecordingTemplate(options, browserTestsDir)
    return { path, code: readFileSync(path, 'utf-8') }
  }

  it('pauses so the Inspector opens with the app already loaded', () => {
    const { code } = generate({ testName: 'demo' })
    expect(code).toContain('await comfyPage.page.pause()')
    expect(code).toContain("from '@e2e/fixtures/ComfyPage'")
  })

  it('loads the chosen workflow before pausing', () => {
    const { code } = generate({ testName: 'demo', workflow: 'default' })
    const loadAt = code.indexOf('loadWorkflow')
    expect(loadAt).toBeGreaterThan(-1)
    expect(loadAt).toBeLessThan(code.indexOf('page.pause()'))
  })

  it('omits the load when recording starts on an empty canvas', () => {
    expect(generate({ testName: 'demo' }).code).not.toContain('loadWorkflow')
  })

  // Asset names come off disk, so a crafted filename must stay data rather
  // than closing the literal and executing in the spec the tool then runs.
  it.for([
    String.raw`evil'); await import('node:child_process'); //`,
    String.raw`back\slash`,
    'new\nline',
    "quote'inside"
  ])('emits %j as a string literal, not code', (workflow) => {
    const { code } = generate({ testName: 'demo', workflow })
    const emitted = code.match(/loadWorkflow\((.*)\)$/m)
    expect(emitted).not.toBeNull()
    expect(JSON.parse(emitted![1])).toBe(workflow)
  })

  it('keeps a hostile test name inside the title literal', () => {
    const { code } = generate({
      testName: String.raw`x'); process.exit(1); //`
    })
    const title = code.match(/^test\((.*), async/m)
    expect(title).not.toBeNull()
    expect(JSON.parse(title![1])).toContain(
      String.raw`x'); process.exit(1); //`
    )
  })

  it('removes the scratch spec, which would otherwise hang later runs', () => {
    const { path } = generate({ testName: 'demo' })
    expect(existsSync(path)).toBe(true)
    cleanupRecordingTemplate(browserTestsDir)
    expect(existsSync(path)).toBe(false)
  })

  it('is a no-op when there is nothing to clean up', () => {
    expect(() => cleanupRecordingTemplate(browserTestsDir)).not.toThrow()
  })
})
