import { execSync } from 'node:child_process'
import { describeRange, readEngines, readNvmrc, satisfies } from './engines'
import { detectPlatform } from './platform'
import { fail, info, pass, warn } from '../ui/logger'
import type { CheckResult } from './types'

function installSteps(target: string): string[] {
  const platform = detectPlatform()
  if (platform === 'windows') {
    return [
      'Install nvm-windows from:',
      '  https://github.com/coreybutler/nvm-windows/releases',
      '',
      'Then open a NEW terminal and run:',
      `  nvm install ${target}`,
      `  nvm use ${target}`
    ]
  }
  const sourceLine =
    platform === 'macos' ? '  source ~/.zshrc' : '  source ~/.bashrc'
  return [
    'Install nvm, then the required Node version:',
    '',
    '  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash',
    sourceLine,
    `  nvm install ${target}`,
    `  nvm use ${target}`
  ]
}

export async function checkNode(): Promise<CheckResult> {
  const required = readEngines().node
  const target = readNvmrc() ?? (required ? describeRange(required) : 'lts')

  let version: string
  try {
    version = execSync('node --version', { encoding: 'utf-8' }).trim()
  } catch {
    fail('Node.js', 'not installed')
    const instructions = installSteps(target)
    info(instructions)
    return { name: 'Node.js', ok: false, installInstructions: instructions }
  }

  if (required && !satisfies(version, required)) {
    warn('Node.js', `${version} (this repo needs ${describeRange(required)})`)
    const instructions = [
      `Node.js ${version} does not match the version this repo requires.`,
      `package.json asks for: ${required}`,
      '',
      ...installSteps(target),
      '',
      'Then re-run this command in the same terminal.'
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
}
