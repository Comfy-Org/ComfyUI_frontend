import { execSync } from 'node:child_process'
import { detectPlatform } from './platform'
import { pass, fail, info } from '../ui/logger'
import type { CheckResult } from './types'

export async function checkGit(): Promise<CheckResult> {
  try {
    const version = execSync('git --version', { encoding: 'utf-8' }).trim()
    const v = version.replace('git version ', '')
    pass('Git', v)
    return { name: 'Git', ok: true, version: v }
  } catch {
    fail('Git', 'not installed')
    const platform = detectPlatform()
    const instructions =
      platform === 'macos'
        ? [
            'Git is included with Xcode CLI Tools. Install them first:',
            '',
            '  xcode-select --install'
          ]
        : platform === 'windows'
          ? [
              'Download Git from: https://git-scm.com/download/win',
              'Run the installer with default settings.'
            ]
          : [
              'Install git using your package manager:',
              '',
              '  sudo apt install git       # Debian/Ubuntu',
              '  sudo dnf install git       # Fedora',
              '  sudo pacman -S git         # Arch'
            ]
    info(instructions)
    return { name: 'Git', ok: false, installInstructions: instructions }
  }
}
