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
  recordedCodePath,
  recordingTarget
} from './template'

describe('recording template', () => {
  let browserTestsDir: string

  beforeEach(() => {
    browserTestsDir = mkdtempSync(join(tmpdir(), 'recording-'))
  })

  afterEach(() => {
    rmSync(browserTestsDir, { recursive: true, force: true })
  })

  function generate(options: {
    testName: string
    workflow?: string
    featureFlags?: Record<string, unknown>
    target?: 'local' | 'cloud'
    storageStateFile?: string
  }) {
    const path = generateRecordingTemplate(options, browserTestsDir)
    return { path, code: readFileSync(path, 'utf-8') }
  }

  it('pauses so the recorder toolbar appears with the app already loaded', () => {
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

  it('seeds selected feature flags before the recorded test', () => {
    const { code } = generate({
      testName: 'demo',
      featureFlags: { onboarding_tour_enabled: true }
    })
    const useAt = code.indexOf('test.use({')
    expect(useAt).toBeGreaterThan(
      code.indexOf("from '@e2e/fixtures/ComfyPage'")
    )
    expect(useAt).toBeLessThan(code.indexOf('test("recording: demo"'))
    expect(code).toContain('onboarding_tour_enabled: true')
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

  // Recording-by-default captured sign-in keystrokes (including passwords)
  // and pre-test exploration; standby captures nothing until the human
  // presses Record.
  it('starts the recorder in standby, not recording', () => {
    for (const target of ['local', 'cloud'] as const) {
      const { code } = generate({ testName: 'demo', target })
      expect(code).toContain("mode: 'standby'")
      expect(code).not.toContain("mode: 'recording'")
    }
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

  describe('cloud target', () => {
    // The comfyPage fixture boots via OSS-only devtools APIs, which cloud
    // backends don't serve — a cloud recording using it dies before the
    // browser is usable.
    it('uses a bare page, never the comfyPage fixture', () => {
      const { code } = generate({ testName: 'demo', target: 'cloud' })
      expect(code).toContain("from '@playwright/test'")
      expect(code).not.toContain('ComfyPage')
      expect(code).not.toContain('comfyPage')
    })

    it('navigates to the dev server and pauses for recording', () => {
      const { code } = generate({ testName: 'demo', target: 'cloud' })
      const gotoAt = code.indexOf('page.goto(process.env.PLAYWRIGHT_TEST_URL')
      expect(gotoAt).toBeGreaterThan(-1)
      expect(gotoAt).toBeLessThan(code.indexOf('_enableRecorder'))
      expect(code).toContain('await page.pause()')
    })

    it('opens the recorder without gating on app boot, so a sign-in screen cannot stall it', () => {
      const { code } = generate({ testName: 'demo', target: 'cloud' })
      expect(code).not.toContain('waitForFunction')
    })

    it('ignores workflows — cloud has no devtools API to pre-load them', () => {
      const { code } = generate({
        testName: 'demo',
        workflow: 'default',
        target: 'cloud'
      })
      expect(code).not.toContain('loadWorkflow')
    })

    it('does not seed localStorage feature flags for cloud recordings', () => {
      const { code } = generate({
        testName: 'demo',
        featureFlags: { onboarding_tour_enabled: true, custom_flag: 12 },
        target: 'cloud'
      })
      expect(code).not.toContain('addInitScript')
      expect(code).not.toContain("'ff:' + key")
    })

    it('omits flag seeding when no flags are selected', () => {
      const { code } = generate({ testName: 'demo', target: 'cloud' })
      expect(code).not.toContain('addInitScript')
    })

    it('keeps a hostile test name inside the title literal', () => {
      const { code } = generate({
        testName: String.raw`x'); process.exit(1); //`,
        target: 'cloud'
      })
      const title = code.match(/^test\((.*), async/m)
      expect(title).not.toBeNull()
      expect(JSON.parse(title![1])).toContain(
        String.raw`x'); process.exit(1); //`
      )
    })

    it('reuses a saved sign-in when the storage-state file exists', () => {
      const stateFile = join(browserTestsDir, 'storage-state.cloud.json')
      writeFileSync(stateFile, '{}')
      const { code } = generate({
        testName: 'demo',
        target: 'cloud',
        storageStateFile: stateFile
      })
      expect(code).toContain(
        `test.use({ storageState: ${JSON.stringify(stateFile)} })`
      )
    })

    it('skips reuse — but still saves — when no sign-in was stored yet', () => {
      const stateFile = join(browserTestsDir, 'storage-state.cloud.json')
      const { code } = generate({
        testName: 'demo',
        target: 'cloud',
        storageStateFile: stateFile
      })
      expect(code).not.toContain('test.use({ storageState:')
      expect(code).toContain(
        `.storageState({ path: ${JSON.stringify(stateFile)} })`
      )
    })

    it('saves the session on a timer, since the window can close at any moment', () => {
      const stateFile = join(browserTestsDir, 'storage-state.cloud.json')
      const { code } = generate({
        testName: 'demo',
        target: 'cloud',
        storageStateFile: stateFile
      })
      const saveAt = code.indexOf('setInterval')
      expect(saveAt).toBeGreaterThan(-1)
      expect(saveAt).toBeGreaterThan(code.indexOf('page.goto('))
      expect(code).toContain('persistLogin.unref()')
    })
  })

  it('never persists sign-in for local recordings', () => {
    const { code } = generate({
      testName: 'demo',
      storageStateFile: join(browserTestsDir, 'storage-state.local.json')
    })
    expect(code).not.toContain('storageState')
  })

  describe('recordingTarget', () => {
    it('keeps the comfyPage template for local backends', () => {
      expect(recordingTarget({ needsLocalBackend: true })).toBe('local')
      expect(recordingTarget(undefined)).toBe('local')
    })

    it('uses the bare-page template for cloud and custom backends', () => {
      expect(recordingTarget({ needsLocalBackend: false })).toBe('cloud')
    })
  })
})
