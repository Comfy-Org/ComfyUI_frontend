import { execSync } from 'node:child_process'
import { pass, fail, info } from '../ui/logger'
import type { CheckResult } from './types'

export async function checkPnpm(): Promise<CheckResult> {
  try {
    const version = execSync('pnpm --version', { encoding: 'utf-8' }).trim()
    pass('pnpm', version)
    return { name: 'pnpm', ok: true, version }
  } catch {
    fail('pnpm', 'not installed')
    const instructions = [
      'Install pnpm via corepack (comes with Node.js):',
      '',
      '  corepack enable',
      '  corepack prepare pnpm@latest --activate',
      '',
      'Or install directly:',
      '',
      '  npm install -g pnpm'
    ]
    info(instructions)
    return { name: 'pnpm', ok: false, installInstructions: instructions }
  }
}
