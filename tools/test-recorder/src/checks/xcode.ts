import { execSync } from 'node:child_process'
import { detectPlatform } from './platform'
import { pass, fail, info } from '../ui/logger'
import type { CheckResult } from './types'

export async function checkXcode(): Promise<CheckResult> {
  if (detectPlatform() !== 'macos') {
    return { name: 'Xcode CLI Tools', ok: true, version: 'n/a (not macOS)' }
  }

  try {
    const path = execSync('xcode-select -p', { encoding: 'utf-8' }).trim()
    pass('Xcode CLI Tools', path)
    return { name: 'Xcode CLI Tools', ok: true, version: path }
  } catch {
    fail('Xcode CLI Tools', 'not installed')
    const instructions = [
      'Xcode Command Line Tools are required for git and build tools.',
      '',
      'To install, run this in Terminal:',
      '',
      '  xcode-select --install',
      '',
      'A popup will appear — click "Install" and wait (~5 min).',
      'When done, come back here and press Enter.'
    ]
    info(instructions)
    return {
      name: 'Xcode CLI Tools',
      ok: false,
      installInstructions: instructions
    }
  }
}
