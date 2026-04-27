import { execSync } from 'node:child_process'
import { pass, fail, warn, info } from '../ui/logger'
import type { CheckResult } from './types'

export async function checkPlaywright(): Promise<CheckResult> {
  try {
    // Check if chromium browser is installed
    execSync('pnpm exec playwright install --dry-run chromium', {
      encoding: 'utf-8',
      stdio: 'pipe'
    })
    pass('Playwright browsers', 'chromium installed')
    return { name: 'Playwright browsers', ok: true, version: 'chromium' }
  } catch {
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
}
