import { writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { formatInitialFeatureFlags } from '../featureFlags'

interface TemplateOptions {
  workflow?: string
  testName: string
  featureFlags?: Record<string, unknown>
}

export const RECORDING_SPEC_BASENAME = '_recording-session'
const RECORDING_SPEC_FILENAME = `${RECORDING_SPEC_BASENAME}.spec.ts`
const RECORDED_CODE_FILENAME = '_recorded-code.txt'

function recordingSpecPath(browserTestsDir: string): string {
  return join(browserTestsDir, 'tests', RECORDING_SPEC_FILENAME)
}

export function recordedCodePath(browserTestsDir: string): string {
  return join(browserTestsDir, 'tests', RECORDED_CODE_FILENAME)
}

export function generateRecordingTemplate(
  options: TemplateOptions,
  browserTestsDir: string
): string {
  const filePath = recordingSpecPath(browserTestsDir)
  const outputPath = recordedCodePath(browserTestsDir)

  // Asset names come off disk, so they are quoted rather than hand-escaped.
  const workflowLine = options.workflow
    ? `  await comfyPage.workflow.loadWorkflow(${JSON.stringify(options.workflow)})\n  await comfyPage.nextFrame()\n`
    : ''

  const safeName = JSON.stringify(`recording: ${options.testName}`)
  const safeOutputPath = JSON.stringify(outputPath)
  const featureFlags = options.featureFlags
    ? formatInitialFeatureFlags(options.featureFlags)
    : ''
  const featureFlagsBlock = featureFlags ? `${featureFlags}\n\n` : ''

  const code = `/**
 * Auto-generated recording session.
 * This file is temporary — it will be deleted after recording.
 *
 * DO NOT COMMIT THIS FILE.
 */
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

${featureFlagsBlock}test(${safeName}, async ({ comfyPage }) => {
${workflowLine}
  // _enableRecorder is a private playwright-core API — same underlying
  // machinery as \`playwright codegen -o <file>\`, just reached through the
  // fixture-booted context instead of the standalone codegen CLI. It writes
  // the generated code to disk continuously (debounced ~250ms) as you
  // record, so closing the browser before copying no longer loses anything.
  // If a future Playwright version removes/renames it, the catch below
  // falls back to an ordinary pause — recording still works, just without
  // the autosave.
  interface RecorderEnabledContext {
    _enableRecorder(params: {
      language: string
      mode: string
      pauseOnNextStatement: boolean
      outputFile: string
    }): Promise<void>
  }
  try {
    // eslint-disable-next-line no-underscore-dangle
    await (
      comfyPage.page.context() as unknown as RecorderEnabledContext
    )._enableRecorder({
      language: 'playwright-test',
      mode: 'recording',
      pauseOnNextStatement: true,
      outputFile: ${safeOutputPath}
    })
  } catch {
    await comfyPage.page.pause()
  }
  // The Playwright Inspector will open.
  //
  // 1. Click the Record button (red circle) to start
  // 2. Perform your test actions in the browser
  //
  // 3. Add an assertion — this is required, not optional. An assertion
  //    checks that something actually happened (a value changed, text
  //    appeared, an element is visible); without one, the test can
  //    "pass" even if the feature is broken. Click an element, then use
  //    the Inspector's toolbar buttons:
  //      "Assert visibility" — element is on screen
  //      "Assert value"      — an input/widget holds a value
  //      "Assert text"       — element contains specific text
  //    Add at least one before stopping.
  //
  // 4. Click Stop, then close the browser window — the code is already
  //    saved, no copy/paste needed.
  await comfyPage.page.pause()
})
`

  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, code)
  return filePath
}

export function cleanupRecordingTemplate(browserTestsDir: string): void {
  const filePath = recordingSpecPath(browserTestsDir)
  try {
    unlinkSync(filePath)
  } catch {
    // File might already be deleted
  }
}

export function cleanupRecordedCode(browserTestsDir: string): void {
  const filePath = recordedCodePath(browserTestsDir)
  try {
    unlinkSync(filePath)
  } catch {
    // File might already be deleted
  }
}
