import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import type { NeedsBackportEvent } from './notify-needs-backport'
import {
  BACKPORT_SOURCE_BRANCH,
  backportTargetsFromLabels,
  buildDirectMessages,
  buildNeedsBackportText,
  escapeSlackText,
  parseSlackRecipients
} from './notify-needs-backport'

function event(
  overrides: Partial<NeedsBackportEvent> = {}
): NeedsBackportEvent {
  return {
    prNumber: 15102,
    prTitle: 'fix: restore the widget dropdown',
    prUrl: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/15102',
    prAuthor: 'jaeone94',
    baseRef: 'main',
    merged: true,
    labeledBy: 'huang47',
    labels: ['needs-backport', 'core/1.47'],
    ...overrides
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
    expect(parseSlackRecipients(raw)).toEqual({ valid: [], invalid: [raw] })
  })

  it('keeps the usable entries when one is malformed', () => {
    expect(parseSlackRecipients('U0BA79D8R1T @huang47')).toEqual({
      valid: ['U0BA79D8R1T'],
      invalid: ['@huang47']
    })
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
  // pr-backport.yaml's three preconditions: merged, based on main, targeted.
  it.for([
    {
      state: 'merged with a target',
      overrides: { merged: true },
      expected: 'is cherry-picking into `core/1.47` now'
    },
    {
      state: 'still open',
      overrides: { merged: false },
      expected: 'will cherry-pick into `core/1.47` once it merges'
    },
    {
      state: 'labelled with no target',
      overrides: { labels: ['needs-backport'] },
      expected: 'No target branch label yet'
    },
    {
      state: 'not based on main',
      overrides: { baseRef: 'core/1.47' },
      expected: 'only runs on pull requests into `main`'
    }
  ])('says what happens next when $state', ({ overrides, expected }) => {
    expect(buildNeedsBackportText(event(overrides))).toContain(expected)
  })

  // The base branch decides whether a backport can happen at all, so a missing
  // target is not the thing to report when the PR is not on main to begin with.
  it('reports the base branch ahead of a missing target', () => {
    const text = buildNeedsBackportText(
      event({ baseRef: 'core/1.47', labels: ['needs-backport'] })
    )

    expect(text).toContain('only runs on pull requests into `main`')
    expect(text).not.toContain('No target branch label yet')
  })

  it('escapes a PR title so it cannot end the link early', () => {
    const text = buildNeedsBackportText(
      event({ prTitle: 'fix: treat a < b && c > d' })
    )

    expect(text).toContain('|#15102 fix: treat a &lt; b &amp;&amp; c &gt; d>\n')
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
    (job) => job.steps ?? []
  )

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

  // This job holds SLACK_BOT_TOKEN on a PR anyone can open. A PR title or
  // branch name expanded into `run:` is a shell for its author.
  it('passes PR-controlled values through the environment only', () => {
    const interpolated = steps
      .filter((step) => step.run?.includes('${{ github.event.pull_request'))
      .map((step) => step.name ?? '<unnamed step>')

    expect(interpolated).toEqual([])
    expect(
      steps.find((step) => step.name === 'Build the direct messages')?.env
    ).toMatchObject({ PR_TITLE: '${{ github.event.pull_request.title }}' })
  })

  // Slack answers HTTP 200 with {"ok":false} on auth, scope and recipient
  // errors, so curl's own status would call a dropped DM a delivered one.
  it('treats a Slack ok:false response as a failure', () => {
    const send = steps.find(
      (step) => step.name === 'Send the direct messages'
    )?.run

    expect(send).toContain('.ok == true')
    expect(send).toContain('FAILED=1')
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
