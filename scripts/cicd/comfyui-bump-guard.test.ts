import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'
import { parse } from 'yaml'

const SCRIPT = path.join(import.meta.dirname, 'comfyui-bump-guard.sh')
const WORKFLOW = '.github/workflows/release-weekly-comfyui.yaml'

function ownedTempDir(prefix: string) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix))
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

function requirementsPinning(line: string) {
  const dir = ownedTempDir('bump-guard-')
  const file = path.join(dir, 'requirements.txt')
  writeFileSync(file, `torch\n${line}\ncomfyui-workflow-templates==0.9.1\n`)
  return file
}

function run(target: string, ...files: string[]) {
  const result = spawnSync('bash', [SCRIPT, target, ...files], {
    encoding: 'utf8'
  })
  return { status: result.status, stdout: result.stdout.trim() }
}

function guard(target: string, ...pins: string[]) {
  const files = pins.map((pin) =>
    requirementsPinning(`comfyui-frontend-package==${pin}`)
  )
  return run(target, ...files)
}

describe('comfyui-bump-guard.sh', () => {
  it.for([
    ['1.57.6', '1.58.1'],
    ['1.57.7', '1.58.2'],
    ['1.58.1', '1.59.0.dev2'],
    ['1.9.9', '1.10.0'],
    ['1.58.9', '1.58.10'],
    ['1.59.0.dev2', '1.59.0'],
    ['1.59.0.dev1', '1.59.0.dev2']
  ])('skips %s when a pin is newer (%s)', ([target, pin]) => {
    expect(guard(target, pin)).toEqual({ status: 0, stdout: 'skip' })
  })

  it.for([
    ['1.58.2', '1.57.7'],
    ['1.58.1', '1.58.1'],
    ['1.10.0', '1.9.9'],
    ['1.59.0', '1.59.0.dev2']
  ])('proceeds with %s over pin %s', ([target, pin]) => {
    expect(guard(target, pin)).toEqual({ status: 0, stdout: 'proceed' })
  })

  it('proceeds when no pinned file is given', () => {
    expect(run('1.58.1')).toEqual({ status: 0, stdout: 'proceed' })
  })

  it('skips when any one of several pins is newer', () => {
    expect(guard('1.57.7', '1.57.6', '1.58.1').stdout).toBe('skip')
    expect(guard('1.58.2', '1.57.6', '1.58.1').stdout).toBe('proceed')
  })

  it.for([
    ['', '1.58.1'],
    ['latest', '1.58.1'],
    ['1.59.0', '1.59.0.post1'],
    ['1.59.0rc1', '1.58.1']
  ])('fails instead of guessing on target %j with pin %j', ([target, pin]) => {
    expect(guard(target, pin).status).not.toBe(0)
  })

  it('fails when a file has no exact frontend pin', () => {
    const loose = requirementsPinning('comfyui-frontend-package>=1.58')
    const missing = requirementsPinning('numpy==2.0.0')
    expect(run('1.57.7', loose).status).not.toBe(0)
    expect(run('1.57.7', missing).status).not.toBe(0)
  })
})

interface Step {
  id?: string
  if?: string
  name?: string
  run?: string
}

function createPrSteps() {
  const workflow = parse(readFileSync(WORKFLOW, 'utf8')) as {
    jobs: Record<string, { steps?: Step[] }>
  }
  return Object.values(workflow.jobs).flatMap((job) => job.steps ?? [])
}

interface StepRun {
  target: string
  masterPin: string
  openPrPin?: string
}

function requirementsText(pin: string) {
  return `torch\ncomfyui-frontend-package==${pin}\n`
}

function runCreatePrStep({ target, masterPin, openPrPin }: StepRun) {
  const step = createPrSteps().find((s) => s.name === 'Create PR to ComfyUI')
  const script = (step?.run ?? '').replaceAll(
    '${{ needs.resolve-version.outputs.target_version }}',
    target
  )
  const root = ownedTempDir('bump-step-')
  const bin = path.join(root, 'bin')
  const comfyui = path.join(root, 'comfyui')
  const guardDir = path.join(root, 'frontend-scripts/scripts/cicd')
  for (const dir of [bin, comfyui, guardDir])
    mkdirSync(dir, { recursive: true })
  copyFileSync(SCRIPT, path.join(guardDir, 'comfyui-bump-guard.sh'))
  chmodSync(path.join(guardDir, 'comfyui-bump-guard.sh'), 0o755)
  writeFileSync(path.join(root, 'pr-body.txt'), 'body\n')
  writeFileSync(path.join(root, 'master.txt'), requirementsText(masterPin))
  writeFileSync(
    path.join(root, 'open.txt'),
    Buffer.from(requirementsText(openPrPin ?? '0.0.0')).toString('base64')
  )
  const pushed = path.join(root, 'pushed')
  writeFileSync(
    path.join(bin, 'git'),
    `#!/usr/bin/env bash
case "$1" in
  show) cat "${root}/master.txt" ;;
  push) touch "${pushed}" ;;
  diff) exit 1 ;;
esac
`
  )
  writeFileSync(
    path.join(bin, 'gh'),
    `#!/usr/bin/env bash
case "$*" in
  *"pulls?state=open&head=Comfy-Org:automation/comfyui-frontend-bump"*)
    ${openPrPin ? 'echo "17999 Comfy-Org/ComfyUI abc123"' : ':'} ;;
  *"contents/requirements.txt?ref=abc123"*) cat "${root}/open.txt" ;;
esac
`
  )
  chmodSync(path.join(bin, 'git'), 0o755)
  chmodSync(path.join(bin, 'gh'), 0o755)
  const output = path.join(root, 'github-output')
  const result = spawnSync('bash', ['-euo', 'pipefail', '-c', script], {
    cwd: comfyui,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      COMFYUI_FORK: 'Comfy-Org/ComfyUI',
      GH_TOKEN: 'fake',
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: path.join(root, 'summary')
    }
  })
  return {
    status: result.status,
    pushed: existsSync(pushed),
    output: existsSync(output) ? readFileSync(output, 'utf8') : ''
  }
}

describe('Create PR to ComfyUI step', () => {
  it('leaves an open PR that pins a newer frontend alone', () => {
    const result = runCreatePrStep({
      target: '1.57.7',
      masterPin: '1.57.6',
      openPrPin: '1.58.1'
    })
    expect(result).toMatchObject({ status: 0, pushed: false })
    expect(result.output).toContain('skipped=true')
  })

  it('does not downgrade when master already pins a newer frontend', () => {
    expect(
      runCreatePrStep({ target: '1.57.7', masterPin: '1.58.1' })
    ).toMatchObject({ status: 0, pushed: false })
  })

  it('replaces an open PR that pins an older frontend', () => {
    expect(
      runCreatePrStep({
        target: '1.58.2',
        masterPin: '1.57.6',
        openPrPin: '1.57.7'
      })
    ).toMatchObject({ status: 0, pushed: true })
  })

  it('pushes a bump when no PR is open', () => {
    expect(
      runCreatePrStep({ target: '1.58.2', masterPin: '1.57.6' })
    ).toMatchObject({ status: 0, pushed: true })
  })

  it('does not report a created PR when the guard skipped', () => {
    const steps = createPrSteps()
    const createPr = steps.find((s) => s.name === 'Create PR to ComfyUI')
    const summary = steps.find(
      (s) => s.name === 'Summary' && s.run?.includes('ComfyUI PR Created')
    )
    expect(summary?.if).toContain(`steps.${createPr?.id}.outputs.skipped`)
  })
})
