import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'

import { resolveCoreTargets } from './core-release-targets'

const NOW = Date.parse('2026-11-19T12:00:00Z')
const HOUR = 60 * 60 * 1000
const branches = [
  'core/1.9',
  'core/1.58',
  'core/1.59',
  'core/1.60',
  'core/1.61',
  'core/2.0',
  'core/feature',
  'cloud/1.59'
]

function repository(pins: { hoursAgo: number; version: string }[]) {
  const directory = mkdtempSync(join(tmpdir(), 'core-release-targets-'))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', directory, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: new Date(NOW - HOUR).toISOString(),
        GIT_COMMITTER_DATE: new Date(NOW - HOUR).toISOString()
      }
    }).trim()
  git('init', '--quiet', '--initial-branch=master')
  for (const { hoursAgo, version } of pins) {
    writeFileSync(
      join(directory, 'requirements.txt'),
      `comfyui-frontend-package==${version}\n`
    )
    git('add', 'requirements.txt')
    const date = new Date(NOW - hoursAgo * HOUR).toISOString()
    execFileSync(
      'git',
      [
        '-C',
        directory,
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'commit.gpgSign=false',
        'commit',
        '--quiet',
        '--allow-empty',
        '-am',
        version
      ],
      {
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 'Test',
          GIT_AUTHOR_EMAIL: 'test@example.com',
          GIT_COMMITTER_NAME: 'Test',
          GIT_COMMITTER_EMAIL: 'test@example.com',
          GIT_AUTHOR_DATE: date,
          GIT_COMMITTER_DATE: date
        },
        input: ''
      }
    )
  }
  return { directory, git }
}

describe('core release eligibility', () => {
  it.for([
    { hoursAgo: 72 - 1 / 3600, minimum: 'core/1.59' },
    { hoursAgo: 72, minimum: 'core/1.60' },
    { hoursAgo: 72 + 1 / 3600, minimum: 'core/1.60' }
  ])(
    'retires the previous line after $hoursAgo hours',
    ({ hoursAgo, minimum }) => {
      const { directory } = repository([
        { hoursAgo: 240, version: '1.59.8' },
        { hoursAgo, version: '1.60.1' }
      ])

      const result = resolveCoreTargets({
        comfyuiPath: directory,
        branches,
        now: NOW
      })

      expect(result.minimum).toBe(minimum)
      expect(result.active).toContain('core/1.60')
      expect(result.active).toContain('core/1.61')
      expect(result.retired).toContain('core/1.9')
      expect([...result.active, ...result.retired]).not.toContain('cloud/1.59')
    }
  )

  it.for([
    { name: 'rollback', pins: [{ hoursAgo: 1, version: '1.59.9' }] },
    {
      name: 'rollback then re-promotion',
      pins: [
        { hoursAgo: 20, version: '1.59.9' },
        { hoursAgo: 19, version: '1.60.2' }
      ]
    }
  ])('keeps the rollback line viable after $name', ({ pins }) => {
    const { directory } = repository([
      { hoursAgo: 240, version: '1.59.8' },
      { hoursAgo: 100, version: '1.60.1' },
      ...pins
    ])

    const result = resolveCoreTargets({
      comfyuiPath: directory,
      branches,
      now: NOW
    })

    expect(result.active).toEqual([
      'core/1.59',
      'core/1.60',
      'core/1.61',
      'core/2.0'
    ])
    expect(result.retired).toEqual(['core/1.9', 'core/1.58'])
  })

  it('does not restart the retirement window for patch updates', () => {
    const { directory } = repository([
      { hoursAgo: 240, version: '1.59.8' },
      { hoursAgo: 80, version: '1.60.1' },
      { hoursAgo: 1, version: '1.60.2' }
    ])

    expect(
      resolveCoreTargets({ comfyuiPath: directory, branches, now: NOW }).active
    ).toEqual(['core/1.60', 'core/1.61', 'core/2.0'])
  })

  it('compares major versions numerically', () => {
    const { directory } = repository([
      { hoursAgo: 240, version: '1.99.7' },
      { hoursAgo: 80, version: '2.0.0' }
    ])

    expect(
      resolveCoreTargets({ comfyuiPath: directory, branches, now: NOW }).active
    ).toEqual(['core/2.0'])
  })

  it('ignores unadopted pins on a merged side branch', () => {
    const { directory, git } = repository([
      { hoursAgo: 240, version: '1.60.1' }
    ])
    git('checkout', '--quiet', '-b', 'feature')
    git('config', 'user.name', 'Test')
    git('config', 'user.email', 'test@example.com')
    writeFileSync(
      join(directory, 'requirements.txt'),
      'comfyui-frontend-package==1.58.1\n'
    )
    git(
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'commit.gpgSign=false',
      'commit',
      '--quiet',
      '-am',
      'side pin'
    )
    git('checkout', '--quiet', 'master')
    git(
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'commit.gpgSign=false',
      'merge',
      '--quiet',
      '-s',
      'ours',
      'feature'
    )

    expect(
      resolveCoreTargets({ comfyuiPath: directory, branches, now: NOW }).minimum
    ).toBe('core/1.60')
  })

  it.for(['1.60.1rc1', '1.60.1\ncomfyui-frontend-package>=1.61.0', 'invalid'])(
    'rejects an unusable pin $0',
    (version) => {
      const { directory } = repository([{ hoursAgo: 240, version }])

      expect(() =>
        resolveCoreTargets({ comfyuiPath: directory, branches, now: NOW })
      ).toThrow('Missing exact frontend pin')
    }
  )

  it('refuses retirement when history cannot cover the window', () => {
    const { directory } = repository([{ hoursAgo: 1, version: '1.60.1' }])

    expect(() =>
      resolveCoreTargets({ comfyuiPath: directory, branches, now: NOW })
    ).toThrow('does not cover the rollback window')
  })
})
