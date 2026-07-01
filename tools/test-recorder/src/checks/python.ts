import { execSync } from 'node:child_process'
import { detectPlatform } from './platform'
import { pass, fail, info } from '../ui/logger'
import type { CheckResult } from './types'

export async function checkPython(): Promise<CheckResult> {
  for (const cmd of ['python3', 'python']) {
    try {
      const version = execSync(`${cmd} --version`, { encoding: 'utf-8' }).trim()
      pass('Python', version)
      return { name: 'Python', ok: true, version }
    } catch {
      continue
    }
  }

  fail('Python 3', 'not installed')
  const platform = detectPlatform()
  const instructions =
    platform === 'macos'
      ? [
          'Python 3 is needed for the ComfyUI backend.',
          '',
          '  brew install python3',
          '',
          'Or download from: https://www.python.org/downloads/'
        ]
      : platform === 'windows'
        ? [
            'Download Python from: https://www.python.org/downloads/',
            'Check "Add Python to PATH" during install.'
          ]
        : [
            '  sudo apt install python3    # Debian/Ubuntu',
            '  sudo dnf install python3    # Fedora'
          ]
  info(instructions)
  return { name: 'Python 3', ok: false, installInstructions: instructions }
}
