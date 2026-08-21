import { execSync } from 'node:child_process'
import { detectPlatform } from './platform'
import { pass, fail, warn, info } from '../ui/logger'
import type { CheckResult } from './types'

export async function checkNode(): Promise<CheckResult> {
  try {
    const version = execSync('node --version', { encoding: 'utf-8' }).trim()
    const major = parseInt(version.replace('v', '').split('.')[0])
    if (major < 20) {
      warn('Node.js', `${version} (need v20+)`)
      const instructions = [
        `Node.js ${version} is too old. You need v20 or later.`,
        '',
        'Update via nvm:',
        '  nvm install 20',
        '  nvm use 20'
      ]
      info(instructions)
      return {
        name: 'Node.js',
        ok: false,
        version,
        installInstructions: instructions
      }
    }
    pass('Node.js', version)
    return { name: 'Node.js', ok: true, version }
  } catch {
    fail('Node.js', 'not installed')
    const platform = detectPlatform()
    const instructions =
      platform === 'macos'
        ? [
            'Install Node.js via nvm (recommended):',
            '',
            '  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash',
            '',
            'Close and reopen Terminal, then run:',
            '',
            '  nvm install 20'
          ]
        : platform === 'windows'
          ? [
              'Download Node.js from: https://nodejs.org/',
              'Choose the LTS version (v20+).',
              'Run the installer with default settings.'
            ]
          : [
              'Install Node.js via nvm:',
              '',
              '  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash',
              '  source ~/.bashrc',
              '  nvm install 20'
            ]
    info(instructions)
    return { name: 'Node.js', ok: false, installInstructions: instructions }
  }
}
