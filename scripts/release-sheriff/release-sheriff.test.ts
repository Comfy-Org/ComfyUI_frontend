import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock(import('node:child_process'), () => ({ execFileSync: vi.fn() }))

import type { PullRequestSummary } from './release-sheriff'
import {
  CONFIG,
  assigneeAccepted,
  fetchDirectory,
  fetchOnCallEmails,
  isSheriffPr,
  loadSheriffConfig,
  nextInRotation,
  parseGithubLogins,
  parseOnCallEmails,
  parseRotationKeys,
  parseSheriffConfig,
  planActions,
  runAssignment,
  resolveSheriff,
  singleLine
} from './release-sheriff'

const config = {
  fallbackGithubLogin: 'fallback-dev',
  githubLoginByUser: { sheriff: 'sheriff-dev' }
}

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

describe('parseOnCallEmails', () => {
  it('reads and dedupes current on-call users from the included graph', () => {
    const payload = {
      included: [
        { type: 'shifts', attributes: { start: '2026-07-22T00:00:00Z' } },
        { type: 'users', attributes: { email: 'a@comfy.org', name: 'A' } },
        { type: 'users', attributes: { email: 'a@comfy.org' } },
        { type: 'users', attributes: { email: 'b@comfy.org' } }
      ]
    }

    expect(parseOnCallEmails(payload)).toEqual(['a@comfy.org', 'b@comfy.org'])
  })

  it('ignores payloads without usable user records', () => {
    expect(parseOnCallEmails(null)).toEqual([])
    expect(parseOnCallEmails({ included: 'nope' })).toEqual([])
    expect(parseOnCallEmails({ included: [{ type: 'users' }] })).toEqual([])
    expect(
      parseOnCallEmails({
        included: [{ type: 'users', attributes: { email: ' ' } }]
      })
    ).toEqual([])
  })
})

describe('parseGithubLogins', () => {
  // Synthetic entries that preserve the seven-entry parser coverage without
  // publishing the real production roster (this repo is public).
  const liveDirectory = JSON.stringify([
    { datadog_email: 'alice@example.org', github_login: 'alice-gh' },
    { datadog_email: 'bob@example.org', github_login: 'bob-gh' },
    { datadog_email: 'carol@example.org', github_login: 'carol-gh' },
    { datadog_email: 'dave@example.org', github_login: 'dave-gh' },
    { datadog_email: 'eve@example.org', github_login: 'eve-gh' },
    { datadog_email: 'frank@example.org', github_login: 'frank-gh' },
    { datadog_email: 'grace@example.org', github_login: 'grace-gh' }
  ])

  it('keys the whole rotation by email local part, as the tags did', () => {
    expect(parseGithubLogins(liveDirectory)).toEqual({
      githubLoginByUser: {
        alice: 'alice-gh',
        bob: 'bob-gh',
        carol: 'carol-gh',
        dave: 'dave-gh',
        eve: 'eve-gh',
        frank: 'frank-gh',
        grace: 'grace-gh'
      },
      warning: null
    })
  })

  it('tolerates unknown fields and upper-cased addresses', () => {
    expect(
      parseGithubLogins(
        JSON.stringify([
          { datadog_email: 'Ann@Comfy.org', github_login: 'ann-gh', team: 'fe' }
        ])
      )
    ).toEqual({ githubLoginByUser: { ann: 'ann-gh' }, warning: null })
  })

  it('warns and maps nothing when the secret is absent or unparseable', () => {
    for (const raw of [undefined, '  ', '{not json', '{"a":1}']) {
      const result = parseGithubLogins(raw)
      expect(result.githubLoginByUser).toEqual({})
      expect(result.warning).toMatch(/release-sheriff-directory\.json/)
    }
  })

  it('does not leak malformed input in the JSON parse warning', () => {
    const result = parseGithubLogins('{not valid json: SENSITIVE_LEAK}')
    expect(result.githubLoginByUser).toEqual({})
    expect(result.warning).toMatch(/is not valid JSON/)
    expect(result.warning).not.toMatch(/SENSITIVE_LEAK/)
  })

  it('keeps usable entries and warns about the ones it dropped', () => {
    const result = parseGithubLogins(
      JSON.stringify([
        { datadog_email: 'ann@comfy.org', github_login: 'ann-gh' },
        { datadog_email: 'bo@comfy.org' },
        { datadog_email: 'cy@comfy.org', github_login: '  ' },
        'nope'
      ])
    )

    expect(result.githubLoginByUser).toEqual({ ann: 'ann-gh' })
    expect(result.warning).toMatch(/3 entries/)
  })

  it('excludes keys that multiple entries normalize to, instead of keeping the last one', () => {
    const result = parseGithubLogins(
      JSON.stringify([
        { datadog_email: 'ann@comfy.org', github_login: 'ann-gh' },
        { datadog_email: 'Ann@Example.org', github_login: 'ann-impersonator' },
        { datadog_email: 'bo@comfy.org', github_login: 'bo-gh' }
      ])
    )

    expect(result.githubLoginByUser).toEqual({ bo: 'bo-gh' })
    expect(result.warning).toMatch(/1 conflicting key \(ann\)/)
  })
})

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
      runAssignment('owner/repo', 'thedatalife', 'christian-byrne', 'config')
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

describe('nextInRotation', () => {
  const rotation = ['a', 'b', 'c']

  it('wraps around and ignores case', () => {
    expect(nextInRotation(rotation, 'B')).toBe('c')
    expect(nextInRotation(rotation, 'c')).toBe('a')
  })

  it('has no answer when the sheriff is alone or absent', () => {
    expect(nextInRotation(['solo'], 'solo')).toBeNull()
    expect(nextInRotation(rotation, 'stranger')).toBeNull()
    expect(nextInRotation([], 'a')).toBeNull()
  })
})

describe('parseRotationKeys', () => {
  const payload = {
    included: [
      {
        type: 'layers',
        id: 'l1',
        relationships: { members: { data: [{ id: 'm2' }, { id: 'm1' }] } }
      },
      {
        type: 'members',
        id: 'm1',
        relationships: { user: { data: { id: 'u1' } } }
      },
      {
        type: 'members',
        id: 'm2',
        relationships: { user: { data: { id: 'u2' } } }
      },
      { type: 'users', id: 'u1', attributes: { email: 'ann@comfy.org' } },
      { type: 'users', id: 'u2', attributes: { email: 'bo@comfy.org' } }
    ]
  }

  it('preserves member order, which is what makes "next" meaningful', () => {
    expect(parseRotationKeys(payload)).toEqual(['bo', 'ann'])
  })

  it('reads nothing from a payload without a member graph', () => {
    expect(parseRotationKeys(null)).toEqual([])
    expect(parseRotationKeys({ included: 'nope' })).toEqual([])
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

describe('CONFIG', () => {
  // The shipped config sat on placeholder values for weeks: every run warned
  // "No Datadog On-Call schedule configured", assigned the fallback, and still
  // went green. Reaching the credentials guard proves the schedule is wired.
  it('is wired up far enough to attempt a Datadog lookup', async () => {
    const result = await fetchOnCallEmails(CONFIG, {})

    expect(result.warning).toMatch(/DATADOG_API_KEY \/ DATADOG_APP_KEY/)
  })
})

describe('fetchOnCallEmails', () => {
  const datadog = { datadogSite: 'datadoghq.com', scheduleId: 'sched-1' }
  const creds = { apiKey: 'api', appKey: 'app' }

  it('warns and skips the request when no schedule is configured', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await fetchOnCallEmails(
      { ...datadog, scheduleId: '' },
      creds
    )

    expect(result.emails).toEqual([])
    expect(result.warning).toMatch(/no datadog on-call schedule/i)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('warns and skips the request when credentials are missing', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await fetchOnCallEmails(datadog, { apiKey: 'api' })

    expect(result.emails).toEqual([])
    expect(result.warning).toMatch(/DATADOG_API_KEY \/ DATADOG_APP_KEY/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('warns on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      })
    )

    const result = await fetchOnCallEmails(datadog, creds)

    expect(result.emails).toEqual([])
    expect(result.warning).toMatch(/503 Service Unavailable/)
  })

  it('warns when the request is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))

    const result = await fetchOnCallEmails(datadog, creds)

    expect(result.emails).toEqual([])
    expect(result.warning).toMatch(/lookup failed \(Error: boom\)/)
  })

  it('returns the parsed on-call emails and no warning on success', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          included: [
            { type: 'users', attributes: { email: 'sheriff@comfy.org' } }
          ]
        })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await fetchOnCallEmails(datadog, creds)

    expect(result).toEqual({ emails: ['sheriff@comfy.org'], warning: null })

    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toBe(
      'https://api.datadoghq.com/api/v2/on-call/schedules/sched-1/responders' +
        '?include=responders.shifts.user&filter%5Bposition%5D=current'
    )
    expect(init.headers).toMatchObject({
      'DD-API-KEY': 'api',
      'DD-APPLICATION-KEY': 'app'
    })
  })

  it('takes the rotation from Datadog and the logins from the secret', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await fetchDirectory(
      datadog,
      creds,
      JSON.stringify([
        { datadog_email: 'sheriff@comfy.org', github_login: 'sheriff-dev' }
      ])
    )

    expect(result).toEqual({
      githubLoginByUser: { sheriff: 'sheriff-dev' },
      rotation: [],
      unmappedMembers: [],
      warnings: []
    })
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      'https://api.datadoghq.com/api/v2/on-call/schedules/sched-1' +
        '?include=layers.members.user'
    )
  })

  it('separates listed members from those still missing a login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            included: [
              {
                type: 'layers',
                id: 'l1',
                relationships: {
                  members: { data: [{ id: 'm1' }, { id: 'm2' }] }
                }
              },
              {
                type: 'members',
                id: 'm1',
                relationships: { user: { data: { id: 'u1' } } }
              },
              {
                type: 'members',
                id: 'm2',
                relationships: { user: { data: { id: 'u2' } } }
              },
              {
                type: 'users',
                id: 'u1',
                attributes: { email: 'ann@comfy.org' }
              },
              { type: 'users', id: 'u2', attributes: { email: 'bo@comfy.org' } }
            ]
          })
      })
    )

    const result = await fetchDirectory(
      datadog,
      creds,
      JSON.stringify([
        { datadog_email: 'ann@comfy.org', github_login: 'ann-gh' }
      ])
    )

    expect(result.rotation).toEqual(['ann-gh'])
    expect(result.unmappedMembers).toEqual(['bo'])
  })

  it('degrades the rotation to empty when Datadog is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))

    const result = await fetchDirectory(datadog, creds, '[]')

    expect(result.rotation).toEqual([])
    expect(result.unmappedMembers).toEqual([])
    expect(result.warnings).toEqual([expect.stringMatching(/lookup failed/)])
  })

  // Datadog going down and the secret going missing are separate failures and
  // the Slack alert has to name both, not whichever is checked first.
  it('reports the Datadog and directory failures together', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))

    const result = await fetchDirectory(datadog, creds, undefined)

    expect(result.warnings).toEqual([
      expect.stringMatching(/lookup failed/),
      expect.stringMatching(/RELEASE_SHERIFF_DIRECTORY is unset/)
    ])
  })
})

describe('resolveSheriff', () => {
  it('maps the on-call email to a GitHub login regardless of case', () => {
    expect(resolveSheriff(['SHERIFF@comfy.org'], config)).toEqual({
      login: 'sheriff-dev',
      source: 'datadog',
      unmappedEmails: []
    })
  })

  it('skips unmapped users and reports them alongside the resolved login', () => {
    expect(
      resolveSheriff(['ghost@comfy.org', 'sheriff@comfy.org'], config)
    ).toEqual({
      login: 'sheriff-dev',
      source: 'datadog',
      unmappedEmails: ['ghost@comfy.org']
    })
  })

  it('falls back when nothing resolves', () => {
    expect(resolveSheriff(['ghost@comfy.org'], config)).toEqual({
      login: 'fallback-dev',
      source: 'fallback',
      unmappedEmails: ['ghost@comfy.org']
    })
  })

  it('reports no sheriff when the fallback is unset', () => {
    expect(
      resolveSheriff([], { ...config, fallbackGithubLogin: '  ' })
    ).toMatchObject({ login: null, source: 'none' })
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
