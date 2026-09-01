import {
  existsSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  rmSync
} from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { formatInitialFeatureFlags } from '../featureFlags'
import type { Distribution } from '../devserver/distributions'

export type RecordingTarget = 'local' | 'cloud'

interface TemplateOptions {
  workflow?: string
  testName: string
  featureFlags?: Record<string, unknown>
  target?: RecordingTarget
  /** Browser storage-state file that persists sign-in across recordings. */
  storageStateFile?: string
}

/**
 * Every custom backend previously shared one cache key ('custom'), so a
 * session saved against one host got replayed against a completely
 * different one — a stale/foreign cookie an unrelated origin will reject,
 * which can surface as an auth redirect loop. Custom backends key by their
 * own hostname instead; the three fixed cloud distributions keep their id.
 */
export function storageStateKey(distribution?: Distribution): string {
  if (!distribution) return 'cloud'
  if (distribution.id !== 'custom' || !distribution.backendUrl) {
    return distribution.id
  }
  try {
    const { hostname, port } = new URL(distribution.backendUrl)
    return `custom-${hostname}${port ? `-${port}` : ''}`
  } catch {
    return 'custom'
  }
}

export function storageStatePath(distributionId: string): string {
  return join(homedir(), '.comfy-test', `storage-state.${distributionId}.json`)
}

export function removeLegacyCustomStorageState(storageStateFile: string): void {
  const legacyStorageStateFile = join(
    dirname(storageStateFile),
    'storage-state.custom.json'
  )
  if (storageStateFile !== legacyStorageStateFile) {
    rmSync(legacyStorageStateFile, { force: true })
  }
}

export function ensureStorageStateDir(storageStateFile: string): void {
  // 0700 — the file holds live session cookies.
  mkdirSync(dirname(storageStateFile), { recursive: true, mode: 0o700 })
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
      // Standby: NOTHING is captured until the Record button is pressed.
      // Signing in, exploring, and getting set up all stay off the record —
      // no accidental actions and no typed passwords end up in the code.
      mode: 'standby',
      pauseOnNextStatement: false,
      outputFile: ${safeOutputPath}
    })
  } catch {
    await ${pageExpr}.pause()
  }
  // 1. Get set up first — sign in, look around. Nothing is being
  //    captured yet.
  // 2. Press the Record button in the floating toolbar (top middle of
  //    the app window) when you are ready. From then on your clicks and
  //    typing are captured.
  // 3. Add a proof step — required. It checks something visible really
  //    happened (text appeared, a value changed). Use the toolbar's
  //    assert buttons next to Record, then click the thing that shows
  //    your action worked.
  // 4. When done, close the browser window — the code is already
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
  const stateFile = options.storageStateFile
  const safeStateFile = stateFile ? JSON.stringify(stateFile) : undefined
  const reuseLoginBlock =
    stateFile && safeStateFile && existsSync(stateFile)
      ? `test.use({ storageState: ${safeStateFile} })

`
      : ''
  // The window can close at any moment and there is no reliable on-close
  // hook, so the signed-in session is saved on a timer — the last save is
  // what the next recording reuses to skip login.
  const persistLoginBlock = safeStateFile
    ? `  const persistLogin = setInterval(() => {
    void page
      .context()
      .storageState({ path: ${safeStateFile} })
      .catch(() => {})
  }, 5000)
  persistLogin.unref()
`
    : ''

  return `${FILE_HEADER}
import { test } from '@playwright/test'

${reuseLoginBlock}test(${safeName}, async ({ page }) => {
  await page.goto(process.env.PLAYWRIGHT_TEST_URL ?? 'http://localhost:5173')
${persistLoginBlock}  // The cloud app may show a sign-in screen first — sign in manually, then
  // record. Nothing is captured until the Record button is clicked, so the
  // recorder opens immediately rather than gating on app boot.
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
