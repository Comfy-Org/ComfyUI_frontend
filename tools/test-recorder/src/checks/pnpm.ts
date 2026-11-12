import { execSync } from 'node:child_process'
import { readEngines, satisfies } from './engines'
import { fail, info, pass, warn } from '../ui/logger'
import type { CheckResult } from './types'

const enableSteps = [
  'pnpm ships with Node.js via corepack. Enable it with:',
  '',
  '  corepack enable',
  '',
  'Then re-run this command.'
]

export async function checkPnpm(): Promise<CheckResult> {
  const required = readEngines().pnpm

  let version: string
  try {
    version = execSync('pnpm --version', { encoding: 'utf-8' }).trim()
  } catch {
    fail('pnpm', 'not installed')
    info(enableSteps)
    return { name: 'pnpm', ok: false, installInstructions: enableSteps }
  }

  if (required && !satisfies(version, required)) {
    warn('pnpm', `${version} (this repo needs ${required})`)
    const instructions = [
      `pnpm ${version} is older than this repo requires (${required}).`,
      '',
      ...enableSteps
    ]
    info(instructions)
    return {
      name: 'pnpm',
      ok: false,
      version,
      installInstructions: instructions
    }
  }

  pass('pnpm', version)
  return { name: 'pnpm', ok: true, version }
}
