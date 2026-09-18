import { readFileSync } from 'node:fs'

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
  parseSlackRecipients
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
    { raw: 'D0BA79D8R1T', valid: ['D0BA79D8R1T'] },
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
    { raw: 'C09K9TPU2G7' }
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

  // `DISABLED` is a `D` and seven more characters, so the obvious way to
  // write the off-switch down parses as a DM channel unless it is recognised
  // first — and a posted-to non-channel fails the run with channel_not_found.
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
      expected: 'merged, so *PR Backport* will cherry-pick into `core/1.47`'
    },
    {
      situation: 'still open',
      overrides: { state: 'OPEN' as const },
      expected: 'will cherry-pick into `core/1.47` once it merges'
    },
    {
      situation: 'closed without merging',
      overrides: { state: 'CLOSED' as const },
      expected: 'closed without merging'
    },
    {
      situation: 'labelled with no target',
      overrides: { labels: ['needs-backport'] },
      expected: 'No target branch label'
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
    expect(text).not.toContain('No target branch label')
  })

  // pr-backport.yaml drops a target whose branch is not cut yet and skips one
  // that already has an open backport PR, so a merged PR cannot be promised a
  // cherry-pick that is already happening.
  // Labelling a release line before it is cut is the case this guards: the
  // branch does not exist, pr-backport.yaml drops the target, and a DM that
  // promised a cherry-pick into it would send the reader looking for a run
  // that never happened.
  it('reports a target whose branch has not been cut', () => {
    const text = buildNeedsBackportText(
      event({ labels: ['needs-backport', 'core/1.47', '1.99'] })
    )

    expect(text).toContain('will cherry-pick into `core/1.47`')
    expect(text).toContain('`core/1.99` has no branch on the remote')
  })

  it('says a backport cannot start when every target is uncut', () => {
    const text = buildNeedsBackportText(
      event({ labels: ['needs-backport', '1.99'] })
    )

    expect(text).toContain('No target branch left')
    expect(text).toContain('`core/1.99` has no branch on the remote')
  })

  // An unreadable remote is not evidence that a branch is missing, and a DM
  // that warned on every target would train the reader to ignore the warning.
  it('promises the cherry-pick when the remote could not be listed', () => {
    const text = buildNeedsBackportText(
      event({ labels: ['needs-backport', '1.99'] }, null)
    )

    expect(text).toContain('will cherry-pick into `core/1.99`')
    expect(text).not.toContain('no branch on the remote')
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
  // it, so nothing off the webhook may reach a script body directly.
  it('passes webhook values through the environment only', () => {
    const interpolated = steps
      .filter((step) => step.run?.includes('${{ github.event'))
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

  // `jq -e` exits 0 on empty input, so the emptiness test is what stops a
  // body that is not JSON — an error page in front of Slack — from reading
  // as a delivered DM.
  it('does not read an unparseable response as a delivered DM', () => {
    expect(sendScript()).toMatch(/\[\s+-n\s+"\$RESPONSE"\s+\][\s\S]{0,80}\.ok/)
  })

  // Every variable the loop counts has to be initialised: the step runs
  // under `set -u`, where one stale name aborts it after the DMs are sent
  // and turns a delivered notification into a failed check.
  it('reads back only the counters it sets', () => {
    const code = sendScript()
    const assigned = new Set([
      ...[...code.matchAll(/^\s*([A-Z][A-Z_]*)=/gm)].map((match) => match[1]),
      ...[...code.matchAll(/\bread\s+-r\s+([A-Z][A-Z_]*)/g)].map(
        (match) => match[1]
      )
    ])
    const read = [...code.matchAll(/\$\{?([A-Z][A-Z_]*)\}?/g)].map(
      (match) => match[1]
    )

    expect(
      read.filter(
        (name) =>
          !assigned.has(name) &&
          !['SLACK_BOT_TOKEN', 'GITHUB_STEP_SUMMARY'].includes(name)
      )
    ).toEqual([])
  })

  // The loop runs under `set -e`, where an unreachable Slack would abort it
  // at the first recipient and the rest would go unnotified and unannotated —
  // the per-recipient accounting exists precisely for that case.
  it('keeps going when one recipient cannot be reached', () => {
    // Just the guard's own block, up to its `fi`. Reading the whole script
    // would match the `continue` that ends the success branch instead, and
    // pass with the failure branch falling through.
    const transportFailure =
      /if\s+!\s+RESPONSE=\$\(\s*curl[\s\S]*?\n\s*fi\b/.exec(sendScript())?.[0]

    expect(transportFailure).toBeDefined()
    expect(transportFailure).toContain('UNDELIVERED=1')
    expect(transportFailure).toContain('continue')
  })

  // The two failures are not interchangeable: an outage fixes itself, while a
  // rejection leaves every DM undelivered until a human acts. If a rejection
  // does not fail the step, this feature can stop working for good on a run
  // that stays green.
  it('fails the step on a rejection but not on an outage', () => {
    const code = sendScript()

    expect(code).toContain('::error::Slack rejected the DM')
    expect(code).toContain('GITHUB_STEP_SUMMARY')
    expect(code).toContain('::warning::Could not reach Slack')
    expect(code).toMatch(/if\s+\[\s+"\$REJECTED"\s+=\s+1\s+\][\s\S]*?exit 1/)
    expect(code).not.toMatch(/\$UNDELIVERED[\s\S]*?exit 1/)
  })

  // Slack's own overload answers are 429 and 5xx, which curl reports as a
  // successful transfer, so without this they would land on the rejection
  // path and redden a PR over a blip that has already passed.
  it('retries Slack, and counts what it still answers as undelivered', () => {
    const code = sendScript()

    expect(code).toMatch(/--retry\s+\d+/)
    expect(code).toContain('--retry-connrefused')
    expect(code).toContain('--retry-all-errors')
    // Each retried attempt appends its own body, so reading the raw stream
    // gives `.error` once per attempt and matches none of the names below.
    expect(code).toMatch(/jq -sc? '\.\[-1\]/)
    for (const transient of [
      'ratelimited',
      'service_unavailable',
      'internal_error',
      'fatal_error',
      'request_timeout'
    ]) {
      expect(code).toContain(transient)
    }
  })

  // A green run is the only thing anybody looks at, so the step that sends
  // the DM must be allowed to redden it.
  it('does not swallow the send step failure', () => {
    expect(
      steps.find((step) => step.name === 'Send the direct messages')
    ).not.toHaveProperty('continue-on-error', true)
  })

  // A step with an `if` loses the implicit success() guard, so the send step
  // has to restore it or a failed build step would still reach curl.
  it('does not send when the message build failed', () => {
    expect(
      steps.find((step) => step.name === 'Send the direct messages')?.if
    ).toContain('success()')
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
