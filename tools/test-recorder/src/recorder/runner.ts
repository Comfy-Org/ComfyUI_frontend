import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import pc from 'picocolors'
import { generateRecordingTemplate, cleanupRecordingTemplate } from './template'
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

/**
 * Find the project root by looking for playwright.config.ts
 */
export function findProjectRoot(): string {
  let dir = process.cwd()
  while (dir !== '/') {
    if (existsSync(join(dir, 'playwright.config.ts'))) {
      return dir
    }
    dir = join(dir, '..')
  }
  throw new Error(
    'Could not find project root (no playwright.config.ts found). ' +
      'Run this command from the ComfyUI_frontend directory.'
  )
}

/**
 * List available workflow assets.
 */
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

/**
 * Run the recording session.
 *
 * 1. Generate the temporary test file with page.pause()
 * 2. Run it in headed mode — this opens the Playwright Inspector
 * 3. User records their actions
 * 4. User closes the browser
 * 5. We save the output as *.raw.spec.ts
 */
export async function runRecording(
  options: RunnerOptions
): Promise<RecordingResult> {
  const browserTestsDir = join(options.projectRoot, 'browser_tests')

  // Generate the recording template
  const tempFile = generateRecordingTemplate(
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

  try {
    // Run the test in headed mode with PWDEBUG to force inspector
    spawnSync(
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
          PWDEBUG: '1',
          PLAYWRIGHT_LOCAL: '1'
        }
      }
    )

    // The user will have copied code from the Inspector.
    // We can't automatically capture Inspector output, so we'll
    // prompt the user to paste it or check if they saved a file.
    console.log()
    console.log(pc.green('  ✅ Recording session complete.'))
    console.log()

    // Save a placeholder raw file — the user pastes codegen output here
    // or the record command handles prompting for it
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
    // Always clean up the temp recording file
    cleanupRecordingTemplate(browserTestsDir)
  }
}
