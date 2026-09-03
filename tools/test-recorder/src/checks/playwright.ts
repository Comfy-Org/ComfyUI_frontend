import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { pass, fail, warn, info } from '../ui/logger'
import type { CheckResult } from './types'

export async function checkPlaywright(): Promise<CheckResult> {
  try {
    // --dry-run only prints the intended path and always exits 0, so the
    // executable itself has to be resolved.
    const executablePath = execSync(
      'pnpm exec node -e "process.stdout.write(require(\'playwright-core\').chromium.executablePath())"',
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim()
    if (!executablePath || !existsSync(executablePath)) {
      console.error('chromium executable missing')
    } else {
      pass('Playwright browsers', 'chromium installed')
      return { name: 'Playwright browsers', ok: true, version: 'chromium' }
    }
  } catch {
    console.error('Unable to resolve the chromium executable')
  }

  // Browser might not be installed, try to check another way
  try {
    const result = execSync('pnpm exec playwright --version', {
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim()
    warn('Playwright', `${result} (browsers may need installing)`)
    const instructions = [
      'Playwright browsers need to be installed:',
      '',
      '  pnpm exec playwright install chromium --with-deps',
      '',
      'This downloads ~200MB. Please wait...'
    ]
    info(instructions)
    return {
      name: 'Playwright browsers',
      ok: false,
      installInstructions: instructions
    }
  } catch {
    fail('Playwright', 'not installed')
    const instructions = [
      'Playwright is a project dependency. Run:',
      '',
      '  pnpm install',
      '  pnpm exec playwright install chromium --with-deps'
    ]
    info(instructions)
    return {
      name: 'Playwright',
      ok: false,
      installInstructions: instructions
    }
  }
}
