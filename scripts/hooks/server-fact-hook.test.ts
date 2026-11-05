import { execFileSync, spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'

import { recentSkipCount } from './server-fact-hook'

const WRITE_GUARD = path.join(import.meta.dirname, 'server-fact-write-guard.ts')
const BROKEN_CONFIG = path.join(import.meta.dirname, 'missing.oxlintrc.json')
const PANEL = 'src/usePanel.ts'

function tempRoot(): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'skip-log-')))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(path.join(root, 'src'))
  writeFileSync(path.join(root, PANEL), 'export const a = canTopUp.value\n')
  return root
}

function runBrokenGuard(root: string) {
  const event = {
    tool_name: 'Edit',
    cwd: root,
    tool_input: {
      file_path: path.join(root, PANEL),
      old_string: 'canTopUp.value',
      new_string: 'canTopUp.value || isOwner.value'
    }
  }
  const { GIT_DIR: _gitDir, ...env } = process.env
  return spawnSync(process.execPath, ['--import', 'tsx', WRITE_GUARD], {
    cwd: path.resolve(import.meta.dirname, '../..'),
    input: JSON.stringify(event),
    encoding: 'utf8',
    env: { ...env, SERVER_FACT_OXLINT_CONFIG: BROKEN_CONFIG }
  })
}

describe('server-fact hook skip log', () => {
  it('records each fail-open skip in the git common dir and reports the weekly count', () => {
    const root = tempRoot()
    execFileSync('git', ['init', '-q'], { cwd: root })
    const logPath = path.join(root, '.git', 'server-fact-guard-skips.log')

    const first = runBrokenGuard(root)
    const second = runBrokenGuard(root)

    expect([first.status, second.status]).toEqual([0, 0])
    expect(second.stderr).toContain(
      `server-fact guard skipped (2 skips in the last 7 days, see ${logPath})`
    )
    const entries = readFileSync(logPath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(entries).toEqual([
      expect.objectContaining({
        hook: 'write-guard',
        reason: expect.stringContaining('oxlint did not produce a report')
      }),
      expect.objectContaining({ hook: 'write-guard' })
    ])
  })

  it('still fails open when the skip cannot be logged', () => {
    const root = tempRoot()
    mkdirSync(path.join(root, '.git'))

    const result = runBrokenGuard(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toMatch(
      /^server-fact guard skipped \(skip log unavailable\): /
    )
  })
})

describe('recentSkipCount', () => {
  it('counts only well-formed entries from the last 7 days', () => {
    const now = new Date('2026-10-09T12:00:00Z')
    const log = [
      JSON.stringify({ ts: '2026-10-09T11:00:00Z', hook: 'write-guard' }),
      JSON.stringify({ ts: '2026-10-03T12:00:01Z', hook: 'approve-guard' }),
      JSON.stringify({ ts: '2026-10-02T11:59:59Z', hook: 'write-guard' }),
      'not json',
      ''
    ].join('\n')

    expect(recentSkipCount(log, now)).toBe(2)
  })
})
