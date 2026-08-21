import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'
import pc from 'picocolors'
import { generateRecordingTemplate, cleanupRecordingTemplate } from './template'
import { runCommand } from '../cli/run'
import { devServerUrl } from '../checks/devServerUrl'
import { box } from '../ui/logger'

interface RunnerOptions {
  testName: string
  workflow?: string
  projectRoot: string
}

interface RecordingResult {
  success: boolean
  rawOutputPath?: string
  error?: string
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

  generateRecordingTemplate(
    { testName: options.testName, workflow: options.workflow },
    browserTestsDir
  )

  console.log()
  box([
    'A browser window will open.',
    '',
    '👉 Perform your test actions:',
    '   • Click, type, drag — everything is recorded',
    '   • Use toolbar buttons to add assertions',
    '   • When done, close the browser window',
    '',
    'The Playwright Inspector shows generated code.'
  ])
  console.log()

  // The temp spec calls page.pause(), so a leaked copy hangs later test runs.
  const cleanUp = () => cleanupRecordingTemplate(browserTestsDir)
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
        '_recording-session',
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

    const rawOutputPath = join(
      browserTestsDir,
      'tests',
      `${options.testName}.raw.spec.ts`
    )

    return { success: true, rawOutputPath }
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
