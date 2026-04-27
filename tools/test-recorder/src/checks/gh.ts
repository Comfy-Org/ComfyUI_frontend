import { execSync } from 'node:child_process'
import { detectPlatform } from './platform'
import { pass, warn, info } from '../ui/logger'
import type { CheckResult } from './types'

export async function checkGh(): Promise<CheckResult> {
  try {
    const version = execSync('gh --version', { encoding: 'utf-8' })
      .split('\n')[0]
      .trim()
    // Check if authenticated
    try {
      execSync('gh auth status', { encoding: 'utf-8', stdio: 'pipe' })
      pass('GitHub CLI (gh)', version.replace('gh version ', ''))
      return { name: 'GitHub CLI', ok: true, optional: true, version }
    } catch {
      warn('GitHub CLI (gh)', 'installed but not authenticated')
      info([
        'Run `gh auth login` to authenticate.',
        "Without auth, we'll help you create PRs manually."
      ])
      return { name: 'GitHub CLI', ok: false, optional: true }
    }
  } catch {
    warn('GitHub CLI (gh)', 'not installed (optional)')
    const platform = detectPlatform()
    const instructions =
      platform === 'macos'
        ? [
            "gh CLI lets us auto-create PRs. Without it, we'll help",
            'you create the PR manually on github.com.',
            '',
            'To install (optional):',
            '  brew install gh',
            '  gh auth login'
          ]
        : platform === 'windows'
          ? [
              'gh CLI is optional. Install from: https://cli.github.com/',
              "Without it, we'll help you create PRs via github.com."
            ]
          : [
              'gh CLI is optional. Install:',
              '  sudo apt install gh    # Debian/Ubuntu',
              '  gh auth login'
            ]
    info(instructions)
    return {
      name: 'GitHub CLI',
      ok: false,
      optional: true,
      installInstructions: instructions
    }
  }
}
