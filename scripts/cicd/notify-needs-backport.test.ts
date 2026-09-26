import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import type { NeedsBackportEvent, PullRequest } from './notify-needs-backport'
import {
  BACKPORT_SOURCE_BRANCH,
  backportTargetsFromLabels,
  buildDirectMessages,
  buildNeedsBackportText,
  escapeSlackText,
  parsePullRequest,
  parseSlackRecipients,
  readRemoteBranches,
  resolveWatchers,
  splitBackportTargets
} from './notify-needs-backport'

const REMOTE_BRANCHES = ['main', 'core/1.47', 'cloud/1.47', 'core/1.46']

function event(
  overrides: Partial<PullRequest> = {},
  remoteBranches: readonly string[] | null = REMOTE_BRANCHES
): NeedsBackportEvent {
  return {
    pullRequest: {
      number: 15102,
      title: 'fix: restore the widget dropdown',
      url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/15102',
      author: 'jaeone94',
      baseRef: 'main',
      state: 'MERGED',
      labels: ['needs-backport', 'core/1.47'],
      ...overrides
    },
    labeledBy: 'huang47',
    remoteBranches
  }
}

describe('backportTargetsFromLabels', () => {
  // Each row is a label form pr-backport.yaml's "Collect backport targets"
  // loop handles, or one it deliberately ignores. A row that disagrees with
  // that loop is the bug: the DM would name a branch nothing cherry-picks
  // into, or stay silent about one it does.
  it.for([
    { label: '1.47', target: 'core/1.47' },
    { label: '1.5', target: 'core/1.5' },
    { label: 'core/1.47', target: 'core/1.47' },
    { label: 'cloud/1.47', target: 'cloud/1.47' },
    { label: 'branch:release/hotfix', target: 'release/hotfix' },
    { label: 'backport:core/1.46', target: 'core/1.46' },
    { label: 'branch: core/1.44 ', target: 'core/1.44' }
  ])('reads $label as $target', ({ label, target }) => {
    expect(backportTargetsFromLabels([label])).toEqual([target])
  })

  it.for([
    // The workflow's version regex is two-part, so a patch version is not a
    // release line and must not be reported as one.
    { label: '1.47.3' },
    { label: 'core/1' },
    { label: 'needs-backport' },
    { label: 'backport' },
    { label: 'size:M' },
    { label: 'Release' },
    // An empty target is skipped by the workflow's own `-z` guard.
    { label: 'branch:' },
    { label: 'backport:   ' }
  ])('ignores $label', ({ label }) => {
    expect(backportTargetsFromLabels([label])).toEqual([])
  })

  it('keeps every distinct target, in label order', () => {
    expect(
      backportTargetsFromLabels([
        'needs-backport',
        'cloud/1.47',
        'size:M',
        '1.45'
      ])
    ).toEqual(['cloud/1.47', 'core/1.45'])
  })

  it('reports a target named twice once, as the workflow does', () => {
    expect(backportTargetsFromLabels(['1.47', 'core/1.47'])).toEqual([
      'core/1.47'
    ])
  })
})

describe('splitBackportTargets', () => {
  it('separates the targets that have a branch from those that do not', () => {
    expect(
      splitBackportTargets(['needs-backport', '1.47', '1.99'], ['core/1.47'])
    ).toEqual({ known: ['core/1.47'], unknown: ['core/1.99'] })
  })

  // The workflow leaves an empty branch list behind when `git ls-remote`
  // fails, and reading that as "no branch exists" would put a warning about
  // every target into every DM.
  it('treats an unlistable remote as no evidence either way', () => {
    expect(splitBackportTargets(['1.47', '1.99'], null)).toEqual({
      known: ['core/1.47', 'core/1.99'],
      unknown: []
    })
  })
})

describe('resolveWatchers', () => {
  // The send step is skipped when there is no recipient, and a skipped step
  // is a green step — so every way of ending up with nobody has to be caught
  // here or it is not caught at all. Rows are the ways a watcher list can be
  // wrong, plus the two that are deliberate.
  it.for([
    {
      raw: 'U0BA79D8R1T',
      situation: 'one good ID',
      recipients: ['U0BA79D8R1T'],
      failed: false
    },
    {
      raw: 'U0BA79D8R1T U024BE7LH',
      situation: 'two good IDs',
      recipients: ['U0BA79D8R1T', 'U024BE7LH'],
      failed: false
    },
    {
      raw: 'disabled',
      situation: 'the off switch',
      recipients: [],
      failed: false
    },
    {
      raw: '@huang47',
      situation: 'a handle instead of an ID',
      recipients: [],
      failed: true
    },
    {
      raw: ' , ',
      situation: 'separators and nothing else',
      recipients: [],
      failed: true
    },
    {
      raw: '',
      situation: 'an empty list',
      recipients: [],
      failed: true
    },
    {
      raw: undefined,
      situation: 'an unset variable',
      recipients: [],
      failed: true
    },
    {
      raw: 'U0BA79D8R1T @huang47',
      situation: 'one good ID and one typo',
      recipients: ['U0BA79D8R1T'],
      failed: true
    },
    // Muting the quick way, without deleting IDs you would have to retype.
    // Honouring the IDs and ignoring the `none` does the opposite of what
    // was asked, so the contradiction is reported rather than resolved.
    {
      raw: 'none U0BA79D8R1T',
      situation: 'the off switch alongside a watcher',
      recipients: ['U0BA79D8R1T'],
      failed: true
    },
    {
      raw: 'off @huang47',
      situation: 'the off switch alongside a typo',
      recipients: [],
      failed: true
    }
  ])('resolves $situation', ({ raw, recipients, failed }) => {
    expect(resolveWatchers(raw)).toMatchObject({ recipients, failed })
  })

  it('says why it failed, in a line the run surfaces', () => {
    const { notices } = resolveWatchers('@huang47')

    expect(notices.join('\n')).toContain('::error::')
    expect(notices.join('\n')).toContain('@huang47')
  })

  it('stays quiet about a list that only turns the notification off', () => {
    expect(resolveWatchers('none').notices.join('\n')).not.toContain('::')
  })
})

describe('readRemoteBranches', () => {
  const write = (contents: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'notify-needs-backport-branches-'))
    const path = join(dir, 'branches.txt')
    writeFileSync(path, contents)
    return path
  }

  it('reads the branch names', () => {
    expect(readRemoteBranches(write('main\ncore/1.47\n'))).toEqual([
      'main',
      'core/1.47'
    ])
  })

  // What the workflow leaves behind when `git ls-remote` fails: the file was
  // created by the redirect, then nothing was written to it. Reading that as
  // an empty list of branches would mark every target uncut.
  it.for([
    { contents: '', situation: 'an empty file' },
    { contents: '\n  \n', situation: 'a file of blank lines' }
  ])('reads $situation as unknown rather than empty', ({ contents }) => {
    expect(readRemoteBranches(write(contents))).toBeNull()
  })

  it.for([
    { path: undefined, situation: 'no path' },
    { path: '/nonexistent/branches.txt', situation: 'a missing file' }
  ])('reads $situation as unknown', ({ path }) => {
    expect(readRemoteBranches(path)).toBeNull()
  })
})

describe('escapeSlackText', () => {
  it('escapes the three characters Slack reserves', () => {
    expect(escapeSlackText('fix: treat a < b && c > d')).toBe(
      'fix: treat a &lt; b &amp;&amp; c &gt; d'
    )
  })

  it('leaves ordinary text alone', () => {
    expect(escapeSlackText('fix: restore the widget dropdown')).toBe(
      'fix: restore the widget dropdown'
    )
  })
})

describe('parseSlackRecipients', () => {
  it.for([
    { raw: 'U0BA79D8R1T', valid: ['U0BA79D8R1T'] },
    { raw: 'U0BA79D8R1T,U024BE7LH', valid: ['U0BA79D8R1T', 'U024BE7LH'] },
    { raw: 'U0BA79D8R1T U024BE7LH', valid: ['U0BA79D8R1T', 'U024BE7LH'] },
    { raw: ' U0BA79D8R1T ,  U024BE7LH ', valid: ['U0BA79D8R1T', 'U024BE7LH'] },
    { raw: 'u0ba79d8r1t', valid: ['U0BA79D8R1T'] },
    { raw: 'U0BA79D8R1T,U0BA79D8R1T', valid: ['U0BA79D8R1T'] },
    { raw: 'W0BA79D8R1T', valid: ['W0BA79D8R1T'] },
    { raw: '', valid: [] },
    { raw: undefined, valid: [] }
  ])('reads $raw as $valid', ({ raw, valid }) => {
    expect(parseSlackRecipients(raw).valid).toEqual(valid)
  })

  // A handle or a channel name is what somebody reaches for when asked for a
  // Slack ID, and Slack rejects it with a bare `channel_not_found`. Reporting
  // it is the difference between a fixable warning and a DM that never comes.
  it.for([
    { raw: '@huang47' },
    { raw: '#frontend-releases' },
    { raw: 'huang47' },
    { raw: 'U123' },
    { raw: 'C09K9TPU2G7' },
    // A DM channel is a thing Slack would accept and nobody would configure;
    // every extra shape accepted here is a mistyped word that reaches Slack.
    { raw: 'D0BA79D8R1T' }
  ])('reports $raw as unusable', ({ raw }) => {
    expect(parseSlackRecipients(raw)).toEqual({
      valid: [],
      invalid: [raw],
      disabled: false
    })
  })

  it('keeps the usable entries when one is malformed', () => {
    expect(parseSlackRecipients('U0BA79D8R1T @huang47')).toMatchObject({
      valid: ['U0BA79D8R1T'],
      invalid: ['@huang47']
    })
  })

  // Recognised by name rather than left to "not an ID": an unusable entry
  // fails the run, so without this the documented way to turn the
  // notification off would redden every labelled PR instead.
  it.for([
    { raw: 'none' },
    { raw: 'off' },
    { raw: 'disabled' },
    { raw: 'OFF' }
  ])('turns the notification off on $raw', ({ raw }) => {
    expect(parseSlackRecipients(raw)).toEqual({
      valid: [],
      invalid: [],
      disabled: true
    })
  })

  it('leaves the watchers alone when nothing asks for the off switch', () => {
    expect(parseSlackRecipients('U0BA79D8R1T').disabled).toBe(false)
  })
})

describe('buildNeedsBackportText', () => {
  it('links the PR and names who labelled it', () => {
    const text = buildNeedsBackportText(event())

    expect(text).toContain(
      '<https://github.com/Comfy-Org/ComfyUI_frontend/pull/15102|#15102 fix: restore the widget dropdown>'
    )
    expect(text).toContain('Author: jaeone94')
    expect(text).toContain('Labelled by: huang47')
  })

  // What the recipient needs from the DM is whether a backport is now under
  // way, waiting on a merge, or not going to happen at all. Each row is one of
  // pr-backport.yaml's preconditions: merged, based on main, targeted.
  it.for([
    {
      situation: 'merged with a target',
      overrides: { state: 'MERGED' as const },
      expected:
        'merged, so *PR Backport* will attempt a cherry-pick into `core/1.47`'
    },
    {
      situation: 'still open',
      overrides: { state: 'OPEN' as const },
      expected: 'will attempt a cherry-pick into `core/1.47` once it merges'
    },
    {
      situation: 'closed without merging',
      overrides: { state: 'CLOSED' as const },
      expected: 'closed without merging'
    },
    {
      situation: 'merged with no target',
      overrides: { labels: ['needs-backport'], state: 'MERGED' as const },
      expected: 'merged with no usable target branch label'
    },
    {
      situation: 'open with no target',
      overrides: { labels: ['needs-backport'], state: 'OPEN' as const },
      expected: 'still open and has no usable target branch label yet'
    },
    {
      situation: 'not based on main',
      overrides: { baseRef: 'core/1.47' },
      expected: 'only runs on pull requests into `main`'
    }
  ])('says what happens next when $situation', ({ overrides, expected }) => {
    expect(buildNeedsBackportText(event(overrides))).toContain(expected)
  })

  // The base branch decides whether a backport can happen at all, so a missing
  // target is not the thing to report when the PR is not on main to begin with.
  it('reports the base branch ahead of a missing target', () => {
    const text = buildNeedsBackportText(
      event({ baseRef: 'core/1.47', labels: ['needs-backport'] })
    )

    expect(text).toContain('only runs on pull requests into `main`')
    expect(text).not.toContain('target branch label')
  })

  // A no-target DM that omits the PR's state cannot be acted on: a typo on a
  // merged PR needs fixing now, while the same label on an open PR is the
  // normal way to mark a line that has not been cut yet.
  it('says whether a PR with no usable target is merged or open', () => {
    const merged = buildNeedsBackportText(
      event({ labels: ['needs-backport'], state: 'MERGED' })
    )
    const open = buildNeedsBackportText(
      event({ labels: ['needs-backport'], state: 'OPEN' })
    )

    expect(merged).toContain('The PR is merged')
    expect(open).toContain('The PR is still open')
  })

  // Labelling a release line before it is cut is the case this guards: the
  // branch does not exist, pr-backport.yaml drops the target, and a DM that
  // promised a cherry-pick into it would send the reader looking for a run
  // that never happened.
  it('reports a target whose branch has not been cut', () => {
    const text = buildNeedsBackportText(
      event({ labels: ['needs-backport', 'core/1.47', '1.99'] })
    )

    expect(text).toContain('will attempt a cherry-pick into `core/1.47`')
    expect(text).toContain('`core/1.99` has no branch on the remote')
  })

  it('agrees in number when more than one target is uncut', () => {
    const text = buildNeedsBackportText(
      event({ labels: ['needs-backport', 'core/1.47', '1.99', '2.0'] })
    )

    expect(text).toContain(
      '`core/1.99`, `core/2.0` have no branch on the remote'
    )
    expect(text).toContain('drops them')
  })

  // Slack reads `<…>` as a link, so an angle bracket in the remediation hint
  // would swallow the placeholder it is there to show. Only the first line
  // may contain one, where the PR link is deliberate.
  it('keeps angle brackets out of everything but the PR link', () => {
    const [, ...rest] = buildNeedsBackportText(
      event({ labels: ['needs-backport'] })
    ).split('\n')

    expect(rest.join('\n')).not.toContain('<')
  })

  it('says a backport cannot start when every target is uncut', () => {
    const text = buildNeedsBackportText(
      event({ labels: ['needs-backport', '1.99'] })
    )

    expect(text).toContain('no usable target branch label')
    expect(text).toContain('`core/1.99` has no branch on the remote')
  })

  // An unreadable remote is not evidence that a branch is missing, and a DM
  // that warned on every target would train the reader to ignore the warning.
  it('promises the cherry-pick when the remote could not be listed', () => {
    const text = buildNeedsBackportText(
      event({ labels: ['needs-backport', '1.99'] }, null)
    )

    expect(text).toContain('will attempt a cherry-pick into `core/1.99`')
    expect(text).not.toContain('no branch on the remote')
  })

  // Slack has no escape for a backtick inside a code span, so one carried in
  // by a label would close the span and spill the rest of the line out of it.
  it('keeps a backtick in a label out of the code span', () => {
    const text = buildNeedsBackportText(
      event({ labels: ['needs-backport', 'branch:foo`bar'] }, ['main'])
    )

    expect(text).toContain('`foobar`')
  })

  it('escapes a PR title so it cannot end the link early', () => {
    const text = buildNeedsBackportText(
      event({ title: 'fix: treat a < b && c > d' })
    )

    expect(text).toContain('|#15102 fix: treat a &lt; b &amp;&amp; c &gt; d>\n')
  })
})

describe('parsePullRequest', () => {
  // Shaped after `GET /repos/{owner}/{repo}/pulls/{number}`, keeping a few of
  // the fields the script ignores. These names are the contract with the API:
  // one read as undefined reaches Slack as "#NaN undefined" unless it throws.
  const REST_PULL_REQUEST = JSON.stringify({
    number: 15102,
    state: 'closed',
    merged: true,
    title: 'fix: restore the widget dropdown',
    html_url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/15102',
    url: 'https://api.github.com/repos/Comfy-Org/ComfyUI_frontend/pulls/15102',
    user: { login: 'jaeone94', id: 1, type: 'User' },
    base: { ref: 'main', sha: 'abc123' },
    head: { ref: 'fix/widget-dropdown', sha: 'def456' },
    labels: [
      { id: 1, name: 'needs-backport', color: 'ededed' },
      { id: 2, name: 'core/1.47', color: 'ededed' }
    ]
  })

  const withoutField = (field: string) => {
    const payload: Record<string, unknown> = JSON.parse(REST_PULL_REQUEST)
    delete payload[field]
    return JSON.stringify(payload)
  }

  it('reads the fields the DM is built from', () => {
    expect(parsePullRequest(REST_PULL_REQUEST)).toEqual({
      number: 15102,
      title: 'fix: restore the widget dropdown',
      url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/15102',
      author: 'jaeone94',
      baseRef: 'main',
      state: 'MERGED',
      labels: ['needs-backport', 'core/1.47']
    })
  })

  // REST spells the three states across two fields, and a backport turns on
  // telling the two closed ones apart.
  it.for([
    { rest: { state: 'open', merged: false }, state: 'OPEN' },
    { rest: { state: 'closed', merged: true }, state: 'MERGED' },
    { rest: { state: 'closed', merged: false }, state: 'CLOSED' }
  ])('reads $rest as $state', ({ rest, state }) => {
    const payload = { ...JSON.parse(REST_PULL_REQUEST), ...rest }

    expect(parsePullRequest(JSON.stringify(payload)).state).toBe(state)
  })

  it('reads an unlabelled PR as having no labels', () => {
    const payload = { ...JSON.parse(REST_PULL_REQUEST), labels: [] }

    expect(parsePullRequest(JSON.stringify(payload)).labels).toEqual([])
  })

  it.for([
    { field: 'number' },
    { field: 'title' },
    { field: 'html_url' },
    { field: 'user' },
    { field: 'base' }
  ])('refuses to build a message without $field', ({ field }) => {
    expect(() => parsePullRequest(withoutField(field))).toThrow()
  })

  it('reads a merged PR as merged even with no state field', () => {
    expect(parsePullRequest(withoutField('state')).state).toBe('MERGED')
  })

  it('refuses a payload that is neither open, closed nor merged', () => {
    const payload: Record<string, unknown> = JSON.parse(REST_PULL_REQUEST)
    delete payload.state
    delete payload.merged

    expect(() => parsePullRequest(JSON.stringify(payload))).toThrow()
  })

  it('refuses a state it cannot reason about', () => {
    const payload = {
      ...JSON.parse(REST_PULL_REQUEST),
      state: 'locked',
      merged: false
    }

    expect(() => parsePullRequest(JSON.stringify(payload))).toThrow(/locked/)
  })
})

describe('buildDirectMessages', () => {
  it('sends one identical message per recipient', () => {
    const messages = buildDirectMessages(event(), ['U0BA79D8R1T', 'U024BE7LH'])

    expect(messages.map((message) => message.channel)).toEqual([
      'U0BA79D8R1T',
      'U024BE7LH'
    ])
    expect(new Set(messages.map((message) => message.text)).size).toBe(1)
    expect(messages[0].text).toBe(buildNeedsBackportText(event()))
  })

  it('sends nothing when no recipient is configured', () => {
    expect(buildDirectMessages(event(), [])).toEqual([])
  })
})

interface WorkflowStep {
  name?: string
  if?: string
  run?: string
  env?: Record<string, string>
}

interface WorkflowTrigger {
  types?: string[]
  branches?: string[]
}

interface Workflow {
  on?: Record<string, WorkflowTrigger | undefined>
  jobs?: Record<string, { if?: string; steps?: WorkflowStep[] } | undefined>
}

const readWorkflow = (path: string) =>
  parse(readFileSync(path, 'utf8')) as Workflow

const NOTIFY_WORKFLOW = '.github/workflows/pr-notify-needs-backport.yaml'

function readSendStep(): string {
  const step = Object.values(readWorkflow(NOTIFY_WORKFLOW).jobs ?? {})
    .flatMap((job) => job?.steps ?? [])
    .find((step) => step.name === 'Send the direct messages')

  expect(step?.run).toBeDefined()
  return step?.run ?? ''
}

describe('pr-notify-needs-backport.yaml', () => {
  const workflow = readWorkflow(NOTIFY_WORKFLOW)
  const steps = Object.values(workflow.jobs ?? {}).flatMap(
    (job) => job?.steps ?? []
  )

  // Comments are dropped before the send step is read: the rationale in this
  // script names the very shell it explains, so `toContain('continue')` would
  // pass on the phrase "continue-on-error" in a comment with every `continue`
  // statement deleted. Asserting against executable shell only is what makes
  // these assertions mean anything.
  const sendScript = () => {
    const step = steps.find((step) => step.name === 'Send the direct messages')

    expect(step).toBeDefined()
    return (step?.run ?? '')
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n')
  }

  // `pull_request` hands a fork PR a read-only token with no secrets, so the
  // same workflow would go quiet for exactly the PRs it is watched for.
  it('runs on the label event under pull_request_target', () => {
    expect(Object.keys(workflow.on ?? {})).toEqual(['pull_request_target'])
    expect(workflow.on?.pull_request_target?.types).toEqual(['labeled'])
  })

  // Every label on every PR fires the event; the gate is what keeps this from
  // DMing on `size:M`.
  it('only acts on the needs-backport label', () => {
    expect(Object.values(workflow.jobs ?? {})[0]?.if).toContain(
      "github.event.label.name == 'needs-backport'"
    )
  })

  // This job holds SLACK_BOT_TOKEN on a PR anyone can open. A PR title, a
  // branch name or a label expanded into `run:` is a shell for whoever wrote
  // it, so nothing off the webhook may reach a script body directly. The test
  // bans every expression rather than the few known-dangerous ones:
  // `github.head_ref` is as attacker-controlled as `github.event.*` and would
  // sail past a narrower filter, and an expression in a `run:` body is
  // reviewable through `env:` instead in every case we have needed so far.
  it('passes webhook values through the environment only', () => {
    const interpolated = steps
      .filter((step) => /\$\{\{/.test(step.run ?? ''))
      .map((step) => step.name ?? '<unnamed step>')

    expect(interpolated).toEqual([])
    expect(
      steps.find((step) => step.name === 'Read the pull request')?.env
    ).toMatchObject({ PR_NUMBER: '${{ github.event.pull_request.number }}' })
  })

  // Slack answers HTTP 200 with {"ok":false} on auth, scope and recipient
  // errors, so curl's own status would call a dropped DM a delivered one.
  it('treats a Slack ok:false response as a failure', () => {
    expect(sendScript()).toContain('.ok == true')
  })

  // `chat.postMessage` has no idempotency key, so a retried POST whose
  // response timed out posts the DM twice. curl also warns that a response
  // captured this way accumulates one body per attempt, which is how a
  // rejection once read as an unparseable answer.
  it('asks Slack once', () => {
    expect(sendScript()).not.toContain('--retry')
  })

  // A green run is the only thing anybody looks at, so the step that sends
  // the DM must be allowed to redden it.
  it('does not swallow the send step failure', () => {
    expect(
      steps.find((step) => step.name === 'Send the direct messages')
    ).not.toHaveProperty('continue-on-error', true)
  })

  // A bad watcher entry has to fail the run without gating the send: the
  // send step is guarded on `success()`, so failing the build step over one
  // typo would silence the DM to every other watcher on the list.
  it('fails an unusable watcher list outside the send path', () => {
    const send = steps.find((step) => step.name === 'Send the direct messages')
    const fail = steps.find(
      (step) => step.name === 'Fail on an unusable watcher list'
    )

    expect(send?.if).not.toContain('watchers_invalid')
    expect(fail?.if).toContain("steps.build.outputs.watchers_invalid == '1'")
    expect(fail?.if).toContain('cancelled()')
    expect(fail?.run).toContain('exit 1')
  })

  // A step with an `if` loses the implicit success() guard, so the send step
  // has to restore it or a failed build step would still reach curl.
  it('does not send when the message build failed', () => {
    expect(
      steps.find((step) => step.name === 'Send the direct messages')?.if
    ).toContain('success()')
  })
})

/**
 * Runs the real `Send the direct messages` shell with `curl` replaced by a
 * stub, which is the only way to tell this step's semantics from its
 * vocabulary: every earlier version of these assertions grepped the script,
 * and grepping passes just as happily on a script whose branches have been
 * swapped as on a correct one.
 */
function runSendStep(
  responses: Record<string, { body?: string; exit?: number }>
): { status: number; stdout: string; summary: string } {
  const dir = mkdtempSync(join(tmpdir(), 'notify-needs-backport-'))

  try {
    const script = join(dir, 'send.sh')
    const summary = join(dir, 'summary.md')
    writeFileSync(script, readSendStep())
    writeFileSync(summary, '')
    writeFileSync(
      join(dir, 'dms.json'),
      JSON.stringify(
        Object.keys(responses).map((channel) => ({ channel, text: 'hello' }))
      )
    )

    // Answers by recipient, so one run can mix a delivery with a failure.
    writeFileSync(
      join(dir, 'curl'),
      [
        '#!/usr/bin/env bash',
        'if [[ "$*" =~ \\"channel\\":\\"([A-Z0-9]+)\\" ]]; then',
        '  CHANNEL="${BASH_REMATCH[1]}"',
        'else',
        '  echo "stub curl: no channel in: $*" >&2; exit 99',
        'fi',
        'HERE="$(dirname "$0")"',
        '[ -f "$HERE/$CHANNEL.body" ] && cat "$HERE/$CHANNEL.body"',
        'if [ -f "$HERE/$CHANNEL.exit" ]; then exit "$(cat "$HERE/$CHANNEL.exit")"; fi',
        'exit 0'
      ].join('\n')
    )
    chmodSync(join(dir, 'curl'), 0o755)

    for (const [channel, response] of Object.entries(responses)) {
      if (response.body !== undefined) {
        writeFileSync(join(dir, `${channel}.body`), response.body)
      }
      if (response.exit !== undefined) {
        writeFileSync(join(dir, `${channel}.exit`), String(response.exit))
      }
    }

    const run = spawnSync('bash', [script], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH ?? ''}`,
        SLACK_BOT_TOKEN: 'xoxb-stub',
        GITHUB_STEP_SUMMARY: summary
      }
    })

    return {
      status: run.status ?? -1,
      stdout: `${run.stdout}${run.stderr}`,
      summary: readFileSync(summary, 'utf8')
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const ok = JSON.stringify({ ok: true, channel: 'D1', ts: '1.2' })
const rejection = JSON.stringify({ ok: false, error: 'channel_not_found' })
const slackError = (error: string) => JSON.stringify({ ok: false, error })

describe('the send step, run against a stubbed Slack', () => {
  it('delivers, and says nothing else', () => {
    const run = runSendStep({ U0BA79D8R1T: { body: ok } })

    expect(run.status).toBe(0)
    expect(run.stdout).toContain('Notified U0BA79D8R1T')
    expect(run.summary).toBe('')
  })

  // Each row is a way Slack can decline, split by who can act on it: the
  // first group clears on its own and must not redden a contributor's PR,
  // the rest name something a human has to change and must not pass quietly.
  it.for([
    { answer: 'ratelimited', status: 0 },
    { answer: 'rate_limited', status: 0 },
    { answer: 'service_unavailable', status: 0 },
    { answer: 'internal_error', status: 0 },
    { answer: 'fatal_error', status: 0 },
    { answer: 'request_timeout', status: 0 },
    { answer: 'channel_not_found', status: 1 },
    { answer: 'missing_scope', status: 1 },
    { answer: 'invalid_auth', status: 1 },
    { answer: 'token_revoked', status: 1 },
    { answer: 'account_inactive', status: 1 }
  ])('exits $status on $answer', ({ answer, status }) => {
    const run = runSendStep({ U0BA79D8R1T: { body: slackError(answer) } })

    expect(run.status).toBe(status)
    expect(run.stdout).not.toContain('Notified')
    expect(run.summary).toContain('U0BA79D8R1T')
  })

  // An answer that is not JSON cannot say a DM was delivered. The empty row
  // is the one that needs the script's own emptiness test: jq 1.6 judges no
  // input at all a success, and which jq runs is the runner image's choice.
  it.for([
    { shape: 'an error page', body: '<html><body>502</body></html>' },
    { shape: 'nothing at all', body: '' }
  ])('does not read $shape as a delivered DM', ({ body }) => {
    const run = runSendStep({ U0BA79D8R1T: { body } })

    expect(run.stdout).not.toContain('Notified')
    expect(run.stdout).toContain('no usable response')
    expect(run.summary).toContain('U0BA79D8R1T')
    expect(run.status).toBe(0)
  })

  // One failure, one explanation: falling through to the response check as
  // well would report the same dropped DM twice, the second time as an
  // unreadable answer that was never received.
  it('reports a Slack it could not reach at all, and passes', () => {
    const run = runSendStep({ U0BA79D8R1T: { exit: 7 } })

    expect(run.status).toBe(0)
    expect(run.stdout).toContain('Could not reach Slack')
    expect(run.stdout).not.toContain('no usable response')
    expect(run.summary).toContain('U0BA79D8R1T')
  })

  // The per-recipient accounting exists for this: under `set -e` the first
  // failure would otherwise abort the loop and leave the rest unnotified.
  it('finishes the list when a recipient fails, and fails the step', () => {
    const run = runSendStep({
      UBADRECIP1: { body: rejection },
      UOUTAGE001: { exit: 7 },
      U0BA79D8R1T: { body: ok }
    })

    expect(run.stdout).toContain('Notified U0BA79D8R1T')
    expect(run.stdout).toContain('::error::Slack rejected the DM to UBADRECIP1')
    expect(run.stdout).toContain('Could not reach Slack to DM UOUTAGE001')
    expect(run.status).toBe(1)
  })

  it('passes when an outage is the only thing that went wrong', () => {
    const run = runSendStep({
      UOUTAGE001: { exit: 7 },
      U0BA79D8R1T: { body: ok }
    })

    expect(run.status).toBe(0)
  })
})

/**
 * Runs the `Read the pull request` shell with `gh` and `git` stubbed.
 *
 * Its `awk` produces the branch list that `readRemoteBranches` consumes, and
 * that side of the contract is covered exhaustively — but only here does
 * anything check that the shell actually emits bare branch names, or that a
 * remote it cannot list leaves the empty file the parser is written for
 * rather than failing the step.
 */
function runReadStep(gitExitCode = 0): {
  status: number
  stdout: string
  branches: string
  pr: string
} {
  const dir = mkdtempSync(join(tmpdir(), 'notify-needs-backport-read-'))

  try {
    const step = Object.values(readWorkflow(NOTIFY_WORKFLOW).jobs ?? {})
      .flatMap((job) => job?.steps ?? [])
      .find((step) => step.name === 'Read the pull request')

    expect(step?.run).toBeDefined()
    writeFileSync(join(dir, 'step.sh'), step?.run ?? '')

    writeFileSync(
      join(dir, 'gh'),
      '#!/usr/bin/env bash\necho \'{"number":15102}\'\n'
    )
    writeFileSync(
      join(dir, 'git'),
      [
        '#!/usr/bin/env bash',
        // A failing `git ls-remote` writes nothing to stdout — it reads the
        // whole ref advertisement before printing any of it.
        `if [ ${gitExitCode} -ne 0 ]; then`,
        '  echo "fatal: could not read from remote repository" >&2',
        `  exit ${gitExitCode}`,
        'fi',
        // The shape it prints on success, including a branch whose own name
        // contains the prefix being stripped.
        "printf '%s\\trefs/heads/%s\\n' aaa main bbb core/1.47 ccc feat/refs/heads-weird"
      ].join('\n')
    )
    chmodSync(join(dir, 'gh'), 0o755)
    chmodSync(join(dir, 'git'), 0o755)

    const run = spawnSync('bash', [join(dir, 'step.sh')], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH ?? ''}`,
        GH_TOKEN: 'stub',
        GH_REPO: 'Comfy-Org/ComfyUI_frontend',
        PR_NUMBER: '15102'
      }
    })

    return {
      status: run.status ?? -1,
      stdout: `${run.stdout}${run.stderr}`,
      branches: readFileSync(join(dir, 'branches.txt'), 'utf8'),
      pr: readFileSync(join(dir, 'pr.json'), 'utf8')
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('the read step, run against a stubbed gh and git', () => {
  it('writes the PR and the bare branch names', () => {
    const run = runReadStep()

    expect(run.status).toBe(0)
    expect(run.pr).toContain('15102')
    expect(run.branches.split('\n').filter(Boolean)).toEqual([
      'main',
      'core/1.47',
      // Only the leading `refs/heads/` goes; a branch named after it survives.
      'feat/refs/heads-weird'
    ])
  })

  // The branch list only sharpens the message, so a remote that cannot be
  // listed has to leave the empty file readRemoteBranches reads as "unknown"
  // — failing here would trade a vaguer DM for no DM at all.
  it('leaves an empty branch list and carries on when the remote is unlistable', () => {
    const run = runReadStep(128)

    expect(run.status).toBe(0)
    expect(run.branches.trim()).toBe('')
    expect(run.stdout).toContain('Could not list the remote branches')
  })
})

/**
 * Runs the script the way the workflow runs it. The unit tests above cover
 * what it decides; this covers what the workflow can see of that decision —
 * the exit code and the step outputs — which is where the two have come
 * apart before.
 */
function runBuildStep(watchers: string): {
  status: number
  outputs: Record<string, string>
  recipients: string[]
} {
  const dir = mkdtempSync(join(tmpdir(), 'notify-needs-backport-build-'))

  try {
    const pr = join(dir, 'pr.json')
    const out = join(dir, 'dms.json')
    const githubOutput = join(dir, 'github-output')
    writeFileSync(
      pr,
      JSON.stringify({
        number: 15102,
        state: 'closed',
        merged: true,
        title: 'fix: restore the widget dropdown',
        html_url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/15102',
        user: { login: 'jaeone94' },
        base: { ref: 'main' },
        labels: [{ name: 'needs-backport' }, { name: 'core/1.47' }]
      })
    )
    writeFileSync(githubOutput, '')

    const run = spawnSync(
      join('node_modules', '.bin', 'tsx'),
      ['scripts/cicd/notify-needs-backport.ts', '--pr', pr, '--out', out],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          LABELED_BY: 'huang47',
          SLACK_NEEDS_BACKPORT_WATCHERS: watchers,
          GITHUB_OUTPUT: githubOutput
        }
      }
    )

    const outputs = Object.fromEntries(
      readFileSync(githubOutput, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const at = line.indexOf('=')
          return [line.slice(0, at), line.slice(at + 1)]
        })
    ) as Record<string, string>

    return {
      status: run.status ?? -1,
      outputs,
      recipients: (
        JSON.parse(readFileSync(out, 'utf8')) as { channel: string }[]
      ).map((message) => message.channel)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('the build step, run as the workflow runs it', () => {
  it('writes the messages and passes for a good watcher list', () => {
    const run = runBuildStep('U0BA79D8R1T U024BE7LH')

    expect(run.status).toBe(0)
    expect(run.recipients).toEqual(['U0BA79D8R1T', 'U024BE7LH'])
    expect(run.outputs).toMatchObject({ count: '2', watchers_invalid: '0' })
  })

  // The send step is guarded on `success()`. Exiting non-zero here to report
  // the typo would skip it, so the one bad entry would silence the DM to
  // everybody else on the list — the failure this reports, caused by
  // reporting it.
  it('still notifies the usable watchers when one entry is a typo', () => {
    const run = runBuildStep('U0BA79D8R1T @newperson')

    expect(run.status).toBe(0)
    expect(run.recipients).toEqual(['U0BA79D8R1T'])
    expect(run.outputs).toMatchObject({ count: '1', watchers_invalid: '1' })
  })

  it('asks for the run to fail when no watcher is usable', () => {
    const run = runBuildStep('@newperson')

    expect(run.status).toBe(0)
    expect(run.recipients).toEqual([])
    expect(run.outputs).toMatchObject({ count: '0', watchers_invalid: '1' })
  })

  it('passes quietly when the notification is turned off', () => {
    const run = runBuildStep('none')

    expect(run.status).toBe(0)
    expect(run.outputs).toMatchObject({ count: '0', watchers_invalid: '0' })
  })
})

describe('pr-backport.yaml', () => {
  // The DM tells the reader a backport only runs on PRs into `main`. That
  // claim is pr-backport.yaml's branch filter, not ours.
  it('still restricts backports to the branch the DM names', () => {
    expect(
      readWorkflow('.github/workflows/pr-backport.yaml').on?.pull_request_target
        ?.branches
    ).toEqual([BACKPORT_SOURCE_BRANCH])
  })
})
