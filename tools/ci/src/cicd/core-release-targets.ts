import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { setOutput } from './actions-output'

type ReleaseLine = readonly [number, number]

function compare(a: ReleaseLine, b: ReleaseLine) {
  return a[0] - b[0] || a[1] - b[1]
}

export function resolveCoreTargets({
  comfyuiPath,
  branches,
  now = Date.now()
}: {
  comfyuiPath: string
  branches: string[]
  now?: number
}) {
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', comfyuiPath, ...args], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024
    }).trim()

  if (git('rev-parse', '--is-shallow-repository') !== 'false') {
    throw new Error('Complete ComfyUI history is required')
  }
  const history = git('log', '--first-parent', '--format=%H %ct').split('\n')
  const cutoff = now / 1000 - 72 * 60 * 60
  let minimum: ReleaseLine | undefined
  let coveredWindow = false

  for (const entry of history) {
    const [sha, timestamp] = entry.split(' ')
    if (Number(timestamp) > now / 1000) {
      throw new Error('ComfyUI history contains a future timestamp')
    }
    const requirements = git('show', `${sha}:requirements.txt`)
    const pins = requirements
      .split('\n')
      .filter((line) => /^\s*comfyui-frontend-package\b/.test(line))
    const pin =
      pins.length === 1 &&
      pins[0].match(
        /^comfyui-frontend-package\s*==\s*(\d+)\.(\d+)\.(\d+)\s*(?:#.*)?$/
      )
    if (!pin) throw new Error(`Missing exact frontend pin at ${sha}`)
    const line: ReleaseLine = [Number(pin[1]), Number(pin[2])]
    if (!minimum || compare(line, minimum) < 0) minimum = line
    if (Number(timestamp) <= cutoff) {
      coveredWindow = true
      break
    }
  }

  if (!minimum || !coveredWindow) {
    throw new Error('ComfyUI history does not cover the rollback window')
  }
  const floor = minimum
  const coreBranches = branches.flatMap((branch) => {
    const match = branch.match(/^core\/(\d+)\.(\d+)$/)
    if (!match) return []
    const line: ReleaseLine = [Number(match[1]), Number(match[2])]
    return [{ branch, line }]
  })
  return {
    minimum: `core/${floor[0]}.${floor[1]}`,
    active: coreBranches
      .filter(({ line }) => compare(line, floor) >= 0)
      .map(({ branch }) => branch),
    retired: coreBranches
      .filter(({ line }) => compare(line, floor) < 0)
      .map(({ branch }) => branch),
    pinSha: history[0].split(' ')[0]
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const branches = execFileSync(
    'git',
    ['ls-remote', '--heads', 'origin', 'core/*'],
    { encoding: 'utf8' }
  )
    .trim()
    .split('\n')
    .map((entry) => entry.split('\trefs/heads/')[1])
    .filter((branch): branch is string => Boolean(branch))
  const targets = resolveCoreTargets({
    comfyuiPath: process.env.COMFYUI_PIN_REPOSITORY || '',
    branches
  })
  setOutput('active', targets.active.join(' '))
  setOutput('retired', targets.retired.join(' '))
  setOutput('pin-sha', targets.pinSha)
}
