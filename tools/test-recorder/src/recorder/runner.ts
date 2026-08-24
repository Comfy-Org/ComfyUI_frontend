import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'
import pc from 'picocolors'
import {
  RECORDING_SPEC_BASENAME,
  cleanupRecordedCode,
  cleanupRecordingTemplate,
  ensureStorageStateDir,
  generateRecordingTemplate,
  recordedCodePath,
  recordingTarget,
  storageStatePath
} from './template'
import { runCommand } from '../cli/run'
import { devServerUrl } from '../checks/devServerUrl'
import { box, info } from '../ui/logger'
import type { Distribution } from '../devserver/distributions'

interface RunnerOptions {
  testName: string
  workflow?: string
  featureFlags?: Record<string, unknown>
  projectRoot: string
  distribution?: Distribution
}

interface RecordingResult {
  success: boolean
  error?: string
  /** Present when the recorder auto-saved the generated code — skips the manual paste step. */
  recordedCode?: string
}

export function findProjectRoot(): string {
  let dir = process.cwd()
  const { root } = parse(dir)
  while (true) {
    if (existsSync(join(dir, 'playwright.config.ts'))) {
      return dir
    }
    if (dir === root) break
    dir = dirname(dir)
  }
  throw new Error(
    'Could not find project root (no playwright.config.ts found). ' +
      'Run this command from the ComfyUI_frontend directory.'
  )
}

export function listWorkflows(projectRoot: string): string[] {
  const assetsDir = join(projectRoot, 'browser_tests', 'assets')
  const results: string[] = []

  function walk(dir: string, prefix: string) {
    try {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry)
        const relPath = prefix ? `${prefix}/${entry}` : entry
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          walk(fullPath, relPath)
        } else if (entry.endsWith('.json')) {
          results.push(relPath.replace(/\.json$/, ''))
        }
      }
    } catch {
      // Directory might not exist
    }
  }

  walk(assetsDir, '')
  return results.sort()
}

export async function runRecording(
  options: RunnerOptions
): Promise<RecordingResult> {
  const browserTestsDir = join(options.projectRoot, 'browser_tests')
  const target = recordingTarget(options.distribution)

  // A Ctrl-C'd session can leave a stale autosave behind — the playwright
  // child flushes it after our signal handler runs. Start clean so this
  // session can't pick up code recorded by a previous one.
  cleanupRecordedCode(browserTestsDir)

  let storageStateFile: string | undefined
  if (target === 'cloud') {
    storageStateFile = storageStatePath(options.distribution?.id ?? 'cloud')
    ensureStorageStateDir(storageStateFile)
  }

  generateRecordingTemplate(
    {
      testName: options.testName,
      workflow: options.workflow,
      featureFlags: options.featureFlags,
      target,
      storageStateFile
    },
    browserTestsDir
  )

  console.log()
  box([
    'Two windows are about to open: the app, and a separate',
    'Playwright Inspector window next to it.',
    '',
    '1. In the Inspector, click the red ⏺ Record button — nothing is',
    '   captured until you do.',
    '2. Perform your test actions in the app window: click, type, drag.',
    '3. Add at least one assertion (required — see below) using the',
    '   Inspector toolbar\'s "Assert visibility/value/text" buttons.',
    '4. When done, just close both windows — your code is saved',
    '   automatically as you go, no copying needed.'
  ])
  console.log()

  // The temp spec calls page.pause(), so a leaked copy hangs later test runs.
  const cleanUp = () => {
    cleanupRecordingTemplate(browserTestsDir)
    cleanupRecordedCode(browserTestsDir)
  }
  const onSignal = () => {
    cleanUp()
    process.exit(130)
  }
  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)

  try {
    const result = runCommand(
      'pnpm',
      [
        'exec',
        'playwright',
        'test',
        RECORDING_SPEC_BASENAME,
        '--headed',
        '--project=chromium',
        '--timeout=0'
      ],
      {
        cwd: options.projectRoot,
        stdio: 'inherit',
        env: {
          ...process.env,
          // No PWDEBUG: it breaks inside fixture setup, before the app loads.
          COMFY_TEST_RECORDING: '1',
          PLAYWRIGHT_LOCAL: '1',
          // Without this the fixture records against :8188's bundled frontend.
          PLAYWRIGHT_TEST_URL: devServerUrl()
        }
      }
    )

    if (result.error) {
      return {
        success: false,
        error: `Failed to spawn pnpm: ${result.error.message}`
      }
    }

    if (result.status !== 0) {
      return {
        success: false,
        error: `Playwright exited with status ${result.status}`
      }
    }

    console.log()
    console.log(pc.green('  ✅ Recording session complete.'))
    console.log()

    // Read before cleanUp() runs in `finally` — it deletes this file.
    const savedCodePath = recordedCodePath(browserTestsDir)
    let recordedCode: string | undefined
    if (existsSync(savedCodePath)) {
      try {
        recordedCode = readFileSync(savedCodePath, 'utf-8')
      } catch {
        // Fall through to the manual paste flow below.
      }
    }
    if (!recordedCode) {
      info([
        "Couldn't find the auto-saved code — falling back to manual paste."
      ])
    }

    return { success: true, recordedCode }
  } catch (err) {
    return {
      success: false,
      error: `Recording failed: ${err instanceof Error ? err.message : String(err)}`
    }
  } finally {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    cleanUp()
  }
}
