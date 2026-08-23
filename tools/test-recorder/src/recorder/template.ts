import { writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { formatInitialFeatureFlags } from '../featureFlags'

export type RecordingTarget = 'local' | 'cloud'

interface TemplateOptions {
  workflow?: string
  testName: string
  featureFlags?: Record<string, unknown>
  target?: RecordingTarget
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

/**
 * The comfyPage fixture boots via OSS-only devtools APIs
 * (`/api/devtools/set_settings` etc.), which cloud backends don't serve.
 * Local recordings get the full fixture; everything else gets a bare-page
 * template that works against any backend.
 */
export function recordingTarget(distribution?: {
  needsLocalBackend: boolean
}): RecordingTarget {
  return !distribution || distribution.needsLocalBackend ? 'local' : 'cloud'
}

const FILE_HEADER = `/**
 * Auto-generated recording session.
 * This file is temporary — it will be deleted after recording.
 *
 * DO NOT COMMIT THIS FILE.
 */`

function recorderBlock(pageExpr: string, safeOutputPath: string): string {
  return `  // _enableRecorder is a private playwright-core API — same underlying
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
      ${pageExpr}.context() as unknown as RecorderEnabledContext
    )._enableRecorder({
      language: 'playwright-test',
      mode: 'recording',
      pauseOnNextStatement: true,
      outputFile: ${safeOutputPath}
    })
  } catch {
    await ${pageExpr}.pause()
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
  await ${pageExpr}.pause()
`
}

function localTemplate(
  options: TemplateOptions,
  safeName: string,
  safeOutputPath: string
): string {
  // Asset names come off disk, so they are quoted rather than hand-escaped.
  const workflowLine = options.workflow
    ? `  await comfyPage.workflow.loadWorkflow(${JSON.stringify(options.workflow)})\n  await comfyPage.nextFrame()\n`
    : ''

  const featureFlags = options.featureFlags
    ? formatInitialFeatureFlags(options.featureFlags)
    : ''
  const featureFlagsBlock = featureFlags ? `${featureFlags}\n\n` : ''

  return `${FILE_HEADER}
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

${featureFlagsBlock}test(${safeName}, async ({ comfyPage }) => {
${workflowLine}
${recorderBlock('comfyPage.page', safeOutputPath)}})
`
}

function cloudTemplate(
  options: TemplateOptions,
  safeName: string,
  safeOutputPath: string
): string {
  const hasFlags =
    options.featureFlags && Object.keys(options.featureFlags).length > 0
  // The app reads feature-flag overrides from localStorage 'ff:<key>' keys —
  // the same mechanism FeatureFlagHelper.seedFlags uses in cloud specs.
  const flagSeedBlock = hasFlags
    ? `  await page.addInitScript((flags) => {
    for (const [key, value] of Object.entries(flags)) {
      localStorage.setItem('ff:' + key, JSON.stringify(value))
    }
  }, ${JSON.stringify(options.featureFlags)})
`
    : ''

  return `${FILE_HEADER}
import { test } from '@playwright/test'

test(${safeName}, async ({ page }) => {
${flagSeedBlock}  await page.goto(process.env.PLAYWRIGHT_TEST_URL ?? 'http://localhost:5173')
  // The cloud app may show a sign-in screen first — sign in manually, then
  // record. Nothing is captured until the Record button is clicked, so the
  // Inspector opens immediately rather than gating on app boot.
${recorderBlock('page', safeOutputPath)}})
`
}

export function generateRecordingTemplate(
  options: TemplateOptions,
  browserTestsDir: string
): string {
  const filePath = recordingSpecPath(browserTestsDir)
  const outputPath = recordedCodePath(browserTestsDir)

  const safeName = JSON.stringify(`recording: ${options.testName}`)
  const safeOutputPath = JSON.stringify(outputPath)

  const code =
    options.target === 'cloud'
      ? cloudTemplate(options, safeName, safeOutputPath)
      : localTemplate(options, safeName, safeOutputPath)

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
