import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  cleanupRecordedCode,
  cleanupRecordingTemplate,
  generateRecordingTemplate,
  recordedCodePath
} from './template'

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

  it('enables the recorder to auto-save generated code, before pausing', () => {
    const { code } = generate({ testName: 'demo' })
    const enableAt = code.indexOf('_enableRecorder')
    // The fallback pause (inside catch) and the real pause the recording
    // blocks on are both executable statements, not comment mentions.
    const pauseCalls = [
      ...code.matchAll(/^\s*await comfyPage\.page\.pause\(\)/gm)
    ]
    expect(enableAt).toBeGreaterThan(-1)
    expect(pauseCalls.length).toBe(2)
    expect(enableAt).toBeLessThan(
      code.lastIndexOf('await comfyPage.page.pause()')
    )
  })

  it('points the recorder at recordedCodePath, quoted as a string literal', () => {
    const { code } = generate({ testName: 'demo' })
    // Matches the call-site value (a quoted literal), not the type
    // declaration's `outputFile: string` field of the same name.
    const outputFileMatch = code.match(/outputFile:\s*("(?:[^"\\]|\\.)*")/)
    const outputFileLiteral = outputFileMatch?.[1]
    if (outputFileLiteral === undefined) {
      throw new Error('Generated template has no outputFile literal')
    }
    const path: unknown = JSON.parse(outputFileLiteral)
    expect(path).toBe(recordedCodePath(browserTestsDir))
  })

  it('removes the auto-saved code file', () => {
    generate({ testName: 'demo' })
    const path = recordedCodePath(browserTestsDir)
    writeFileSync(path, 'generated code')
    expect(existsSync(path)).toBe(true)
    cleanupRecordedCode(browserTestsDir)
    expect(existsSync(path)).toBe(false)
  })

  it('is a no-op cleaning up recorded code that was never saved', () => {
    expect(() => cleanupRecordedCode(browserTestsDir)).not.toThrow()
  })
})
