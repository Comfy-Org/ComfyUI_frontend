import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock(import('node:child_process'), () => ({ execFileSync: vi.fn() }))

import type { PullRequestSummary } from './release-sheriff'
import {
  assigneeAccepted,
  isSheriffPr,
  loadSheriffConfig,
  parseSheriffConfig,
  planActions,
  runAssignment,
  singleLine
} from './release-sheriff'

function pr(overrides: Partial<PullRequestSummary> = {}): PullRequestSummary {
  return {
    number: 1,
    title: 'fix: something',
    isDraft: false,
    headRefName: 'fix/something',
    labels: [],
    assignees: [],
    reviewRequests: [],
    latestReviews: [],
    reviewDecision: null,
    author: { login: 'someone' },
    ...overrides
  }
}

describe('parseSheriffConfig', () => {
  it('reads the sheriff and the backup reviewer, trimming each', () => {
    expect(
      parseSheriffConfig(
        '{"sheriff":" thedatalife ","backupReviewer":"christian-byrne"}'
      )
    ).toEqual({
      config: { sheriff: 'thedatalife', backupReviewer: 'christian-byrne' },
      error: null
    })
  })

  it('ignores unknown fields so the file can carry its own documentation', () => {
    expect(
      parseSheriffConfig(
        '{"_comment":["why this exists"],"sheriff":"a","backupReviewer":"b"}'
      ).config
    ).toEqual({ sheriff: 'a', backupReviewer: 'b' })
  })

  const malformed: [label: string, raw: string, expected: RegExp][] = [
    ['text that is not JSON', 'not json', /not valid JSON/],
    ['a JSON array', '[]', /not a JSON object/],
    ['null', 'null', /not a JSON object/],
    ['a missing sheriff', '{"backupReviewer":"b"}', /no usable "sheriff"/],
    [
      'a blank sheriff',
      '{"sheriff":" ","backupReviewer":"b"}',
      /no usable "sheriff"/
    ],
    ['a missing backup', '{"sheriff":"a"}', /no usable "backupReviewer"/],
    [
      'a sheriff login with a space',
      '{"sheriff":"the data life","backupReviewer":"b"}',
      /"the data life" is not a GitHub username/
    ],
    [
      'a backup login with a space',
      '{"sheriff":"a","backupReviewer":"christian byrne"}',
      /"christian byrne" is not a GitHub username/
    ],
    [
      'a login starting with a hyphen',
      '{"sheriff":"-nope","backupReviewer":"b"}',
      /not a GitHub username/
    ],
    [
      'a login ending with a hyphen',
      '{"sheriff":"nope-","backupReviewer":"b"}',
      /not a GitHub username/
    ],
    [
      'a login with consecutive hyphens',
      '{"sheriff":"no--pe","backupReviewer":"b"}',
      /not a GitHub username/
    ],
    [
      'a login over 39 characters',
      `{"sheriff":"${'a'.repeat(40)}","backupReviewer":"b"}`,
      /not a GitHub username/
    ],
    [
      'a blank backup',
      '{"sheriff":"a","backupReviewer":""}',
      /no usable "backupReviewer"/
    ]
  ]

  it.for(malformed)('rejects %s', ([, raw, expected]) => {
    const { config, error } = parseSheriffConfig(raw)

    expect(config).toBeNull()
    expect(error).toMatch(expected)
  })

  it('accepts the hyphenated and 39-character logins GitHub allows', () => {
    const longest = 'a'.repeat(39)

    expect(
      parseSheriffConfig(
        `{"sheriff":"christian-byrne","backupReviewer":"${longest}"}`
      )
    ).toEqual({
      config: { sheriff: 'christian-byrne', backupReviewer: longest },
      error: null
    })
  })

  it('rejects a backup reviewer who is the sheriff, ignoring case', () => {
    const { config, error } = parseSheriffConfig(
      '{"sheriff":"thedatalife","backupReviewer":"TheDataLife"}'
    )

    expect(config).toBeNull()
    expect(error).toMatch(/same login as both "sheriff" and "backupReviewer"/)
  })
})

describe('assigneeAccepted', () => {
  const issue = (...logins: string[]) => ({
    assignees: logins.map((login) => ({ login }))
  })

  it('confirms the login GitHub echoed back, ignoring case', () => {
    expect(assigneeAccepted(issue('TheDataLife'), 'thedatalife')).toBe(true)
    expect(
      assigneeAccepted(issue('someone', 'thedatalife'), 'thedatalife')
    ).toBe(true)
  })

  // The failure this exists for: GitHub drops an assignee without push access
  // and still answers 201, so an empty list is a successful-looking no-op.
  it('rejects a response that silently dropped the login', () => {
    expect(assigneeAccepted(issue(), 'thedatalife')).toBe(false)
    expect(assigneeAccepted(issue('someone-else'), 'thedatalife')).toBe(false)
  })

  const unusable: [label: string, response: unknown][] = [
    ['a non-object', 'nope'],
    ['null', null],
    ['an object with no assignees', {}],
    ['assignees that is not an array', { assignees: 'nope' }],
    ['assignee entries without a login', { assignees: [{}, { login: 7 }] }]
  ]

  it.for(unusable)('rejects %s', ([, response]) => {
    expect(assigneeAccepted(response, 'thedatalife')).toBe(false)
  })
})

describe('runAssignment', () => {
  // The caller path for a failed assignment. assigneeAccepted is covered above,
  // but nothing proved runAssignment acts on a false result -- and if it stops,
  // a PR silently stays unowned while the run reports success.
  function run(
    issueAfterPost: { assignees: { login: string }[] },
    reviewRequestFails = false
  ) {
    const dir = mkdtempSync(join(tmpdir(), 'release-sheriff-'))
    const file = join(dir, 'github-output')
    const priorFile = process.env.GITHUB_OUTPUT
    const priorCode = process.exitCode
    process.env.GITHUB_OUTPUT = file
    process.exitCode = 0

    const candidate = pr({ number: 42, labels: [{ name: 'backport' }] })
    let listed = false
    vi.mocked(execFileSync).mockImplementation((_file, args) => {
      const argv = args ?? []
      if (argv[0] === 'pr' && argv[1] === 'list') {
        if (listed) return '[]'
        listed = true
        return JSON.stringify([candidate])
      }
      if (argv.some((arg) => arg.endsWith('/assignees'))) {
        return JSON.stringify(issueAfterPost)
      }
      if (reviewRequestFails) throw new Error('gh: 422 Unprocessable Entity')
      return ''
    })

    try {
      runAssignment('owner/repo', 'thedatalife', 'christian-byrne')
      return {
        exitCode: process.exitCode,
        degraded: existsSync(file) ? readFileSync(file, 'utf8') : ''
      }
    } finally {
      // Assigning undefined would set the literal string 'undefined', leaving
      // a later test writing its output to a path named that.
      if (priorFile === undefined) delete process.env.GITHUB_OUTPUT
      else process.env.GITHUB_OUTPUT = priorFile
      process.exitCode = priorCode
      vi.mocked(execFileSync).mockReset()
      rmSync(dir, { recursive: true, force: true })
    }
  }

  it('fails the run when GitHub drops the assignee it just accepted', () => {
    const { exitCode, degraded } = run({ assignees: [] })

    expect(exitCode).toBe(1)
    expect(degraded).toContain('#42 is not confirmed assigned to `thedatalife`')
    expect(degraded).toMatch(/Cause not established/)
    // One heredoc record: a second would misparse the first's terminator.
    expect(degraded.match(/^degraded<<__EOF__$/gm)).toHaveLength(1)
  })

  // The other half of the same guarantee: a backport that is assigned but has
  // nobody asked to review it never reaches the approval backport-auto-merge
  // waits for, so a rejected request has to fail the run too.
  it(
    'fails the run when GitHub rejects the review request',
    { timeout: 20_000 },
    () => {
      const { exitCode, degraded } = run(
        { assignees: [{ login: 'thedatalife' }] },
        true
      )

      expect(exitCode).toBe(1)
      expect(degraded).toContain(
        '#42 has no confirmed review request for `thedatalife`'
      )
      expect(degraded).not.toContain('is not confirmed assigned')
    }
  )

  it('stays green when GitHub echoes the assignee back', () => {
    const { exitCode, degraded } = run({
      assignees: [{ login: 'TheDataLife' }]
    })

    expect(exitCode).toBe(0)
    expect(degraded).toBe('')
  })
})

describe('singleLine', () => {
  it('cannot emit a line that closes a GITHUB_OUTPUT heredoc early', () => {
    expect(singleLine('before\n__EOF__\nafter')).toBe('before __EOF__ after')
  })

  it('collapses incidental whitespace', () => {
    expect(singleLine('  a\t\tb \n c  ')).toBe('a b c')
  })
})

describe('the shipped .github/release-sheriff.json', () => {
  // parseSheriffConfig is exercised on inline literals above, so all of it
  // still passes with a typo in the file the workflow actually reads. This is
  // the gate the file's own comment promises: a PR that blanks a login or
  // names one person as both sheriff and backup fails here.
  it('parses, so a bad edit fails the PR that writes it', () => {
    const { config, error } = loadSheriffConfig()

    expect(error).toBeNull()
    expect(config).not.toBeNull()
  })
})

describe('isSheriffPr', () => {
  it('matches backports and release version-bump PRs', () => {
    expect(isSheriffPr(pr({ labels: [{ name: 'backport' }] }))).toBe(true)
    expect(isSheriffPr(pr({ title: '[Backport core/1.46] fix: x' }))).toBe(true)
    expect(isSheriffPr(pr({ labels: [{ name: 'Release' }] }))).toBe(true)
    expect(isSheriffPr(pr({ headRefName: 'version-bump-1.45.22' }))).toBe(true)
    expect(isSheriffPr(pr({ headRefName: 'version-bump-1.46.0-beta.1' }))).toBe(
      true
    )
  })

  it('matches anything opened by automation, whatever it is about', () => {
    for (const login of [
      'app/dependabot',
      'app/cloud-code-bot',
      'comfy-pr-bot'
    ])
      expect(isSheriffPr(pr({ author: { login } }))).toBe(true)
  })

  it('ignores humans whose login merely resembles a bot', () => {
    expect(isSheriffPr(pr({ author: { login: 'dependabot-fan' } }))).toBe(false)
    expect(isSheriffPr(pr({ author: null }))).toBe(false)
  })

  it('ignores feature branches that merely start with version-bump-', () => {
    expect(isSheriffPr(pr())).toBe(false)
    expect(isSheriffPr(pr({ headRefName: 'feat/version-bump-ui' }))).toBe(false)
    expect(
      isSheriffPr(pr({ headRefName: 'version-bump-fix-subscription-i18n' }))
    ).toBe(false)
  })

  it('ignores PRs that merely mention backport in the title', () => {
    expect(
      isSheriffPr(pr({ title: 'feat(ci): auto-assign backport PRs' }))
    ).toBe(false)
    expect(
      isSheriffPr(pr({ title: 'docs: explain the backport process' }))
    ).toBe(false)
  })
})

describe('planActions', () => {
  it('assigns and requests review on an untouched backport PR', () => {
    expect(
      planActions(
        [pr({ number: 7, labels: [{ name: 'backport' }] })],
        'sheriff'
      )
    ).toEqual([
      { number: 7, assign: true, requestReview: true, reviewer: 'sheriff' }
    ])
  })

  it('never overwrites an existing assignee or review request', () => {
    const prs = [
      pr({
        number: 1,
        labels: [{ name: 'backport' }],
        assignees: [{ login: 'dev' }]
      }),
      pr({
        number: 2,
        labels: [{ name: 'backport' }],
        reviewRequests: [{ login: 'dev' }]
      })
    ]

    expect(planActions(prs, 'sheriff')).toEqual([
      { number: 1, assign: false, requestReview: true, reviewer: 'sheriff' },
      { number: 2, assign: true, requestReview: false, reviewer: 'sheriff' }
    ])
  })

  it('does not request review on approved PRs, nor from the sheriff on their own', () => {
    const prs = [
      pr({
        number: 1,
        labels: [{ name: 'backport' }],
        reviewDecision: 'APPROVED'
      }),
      pr({
        number: 2,
        labels: [{ name: 'backport' }],
        author: { login: 'Sheriff' }
      })
    ]

    expect(planActions(prs, 'sheriff')).toEqual([
      { number: 1, assign: true, requestReview: false, reviewer: 'sheriff' },
      { number: 2, assign: true, requestReview: false, reviewer: null }
    ])
  })

  it('asks the standby to review the sheriff’s own PR', () => {
    const own = pr({
      number: 3,
      labels: [{ name: 'backport' }],
      author: { login: 'Sheriff' }
    })

    expect(planActions([own], 'sheriff', 'b')).toEqual([
      { number: 3, assign: true, requestReview: true, reviewer: 'b' }
    ])
  })

  it('does not re-request review from a sheriff who already reviewed', () => {
    const prs = [
      pr({
        number: 1,
        labels: [{ name: 'backport' }],
        assignees: [{ login: 'dev' }],
        latestReviews: [{ author: { login: 'Sheriff' } }],
        reviewDecision: 'CHANGES_REQUESTED'
      }),
      pr({
        number: 2,
        labels: [{ name: 'backport' }],
        latestReviews: [{ author: { login: 'someone-else' } }]
      })
    ]

    expect(planActions(prs, 'sheriff')).toEqual([
      { number: 2, assign: true, requestReview: true, reviewer: 'sheriff' }
    ])
  })

  it('skips drafts and out-of-scope PRs', () => {
    const prs = [
      pr({ number: 1, labels: [{ name: 'backport' }], isDraft: true }),
      pr({ number: 2 })
    ]

    expect(planActions(prs, 'sheriff')).toEqual([])
  })
})
