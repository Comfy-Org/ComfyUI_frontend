import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const workflowSchema = z.object({
  jobs: z.object({
    backport: z.object({
      steps: z.array(
        z.object({ id: z.string().optional(), run: z.string().optional() })
      )
    })
  })
})

const PR_NUMBER = '21829'
const TARGET = 'core/1.0'

function backportScript(): string {
  const workflow = workflowSchema.parse(
    parse(readFileSync('.github/workflows/pr-backport.yaml', 'utf8'))
  )
  const step = workflow.jobs.backport.steps.find(
    (step) => step.id === 'backport'
  )
  if (!step?.run) throw new Error('Missing backport script')
  return step.run
    .replaceAll('${{ github.event_name }}', 'workflow_dispatch')
    .replaceAll('${{ inputs.pr_number }}', PR_NUMBER)
    .replaceAll('${{ steps.filter-targets.outputs.pending-targets }}', TARGET)
}

let dir: string
let work: string

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: work, encoding: 'utf8' }).trim()
}

function commitFile(content: string, message: string): string {
  writeFileSync(join(work, 'file.txt'), content)
  git('add', 'file.txt')
  git('commit', '--quiet', '-m', message)
  return git('rev-parse', 'HEAD')
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pr-backport-commits-'))
  work = join(dir, 'work')
  execFileSync('git', ['init', '--quiet', '--bare', join(dir, 'origin.git')])
  execFileSync('git', ['init', '--quiet', '-b', 'main', work])
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'test')
  git('remote', 'add', 'origin', join(dir, 'origin.git'))
  commitFile('one\n', 'base')
  git('branch', TARGET)
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function runBackport(mergeCommit: string) {
  git('push', '--quiet', 'origin', 'main', TARGET)
  writeFileSync(
    join(dir, 'gh'),
    `#!/usr/bin/env bash\necho '{"title":"Change","mergeCommit":{"oid":"${mergeCommit}"}}'\n`
  )
  chmodSync(join(dir, 'gh'), 0o755)
  const output = join(dir, 'github-output')
  writeFileSync(output, '')
  const result = spawnSync(
    'bash',
    ['--noprofile', '--norc', '-c', backportScript()],
    {
      cwd: work,
      env: {
        PATH: `${dir}:${process.env.PATH}`,
        HOME: dir,
        GITHUB_OUTPUT: output,
        PR_NUMBER
      },
      encoding: 'utf8'
    }
  )
  return { ...result, outputs: readFileSync(output, 'utf8') }
}

describe('pr-backport cherry-pick step', () => {
  it('reports a target that already has the change by hand as already backported, not as a conflict', () => {
    git('checkout', '--quiet', TARGET)
    commitFile('two\n', 'hand-made backport')
    git('checkout', '--quiet', 'main')
    const mergeCommit = commitFile('two\n', 'change')

    const { outputs } = runBackport(mergeCommit)

    expect(outputs).toContain(`failed=${TARGET}:already-exists `)
    expect(outputs).not.toContain('conflicts')
  })

  it('still reports a real conflict', () => {
    git('checkout', '--quiet', TARGET)
    commitFile('three\n', 'diverged')
    git('checkout', '--quiet', 'main')
    const mergeCommit = commitFile('two\n', 'change')

    const { outputs } = runBackport(mergeCommit)

    expect(outputs).toContain(`failed=${TARGET}:conflicts:file.txt, `)
  })

  it('pushes a clean cherry-pick', () => {
    const mergeCommit = commitFile('two\n', 'change')

    const { outputs } = runBackport(mergeCommit)

    expect(outputs).toContain(
      `success=${TARGET}:backport-${PR_NUMBER}-to-core-1.0 `
    )
  })
})
