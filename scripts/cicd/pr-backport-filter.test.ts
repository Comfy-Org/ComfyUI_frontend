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

const filterScript = () => {
  const workflow = workflowSchema.parse(
    parse(readFileSync('.github/workflows/pr-backport.yaml', 'utf8'))
  )
  const step = workflow.jobs.backport.steps.find(
    (step) => step.id === 'filter-targets'
  )
  if (!step?.run) throw new Error('Missing filter-targets script')
  return step.run
}

const GH_STUB = `#!/usr/bin/env bash
state="" head="" base="" filter="." fields=""
while [ $# -gt 0 ]; do
  case "$1" in
    --state) state="$2"; shift 2 ;;
    --head) head="$2"; shift 2 ;;
    --base) base="$2"; shift 2 ;;
    --json) fields="$2"; shift 2 ;;
    --jq) filter="$2"; shift 2 ;;
    *) shift ;;
  esac
done
matches=$(jq -c --arg state "$state" --arg head "$head" --arg base "$base" '
  map(select(.state == $state
    and ($base == "" or .base == $base)
    and ($head == "" or .head == $head)))
  | map({
      number,
      headRefName: .head,
      isCrossRepository: (.crossRepository // false),
      title: (.title // ""),
      body: (.body // "")
    })' <<< "$STUB_PRS")
matches=$(jq -c --arg fields "$fields" 'map(with_entries(select(.key as $key | $fields | split(",") | index($key))))' <<< "$matches")
jq -r "$filter" <<< "$matches"
`

const GIT_STUB = `#!/usr/bin/env bash
for branch in $STUB_BRANCHES; do
  printf '0000000\\trefs/heads/%s\\n' "$branch"
done
`

interface StubPr {
  state: 'open' | 'merged'
  head: string
  base: string
  number: number
  crossRepository?: boolean
  title?: string
  body?: string
}

interface Scenario {
  targets: string[]
  prs?: StubPr[]
  branches?: string[]
  forceRerun?: boolean
}

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pr-backport-filter-'))
  for (const [name, body] of [
    ['gh', GH_STUB],
    ['git', GIT_STUB]
  ]) {
    writeFileSync(join(dir, name), body)
    chmodSync(join(dir, name), 0o755)
  }
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function runFilter({
  targets,
  prs = [],
  branches = [],
  forceRerun = false
}: Scenario) {
  const outputFile = join(dir, 'output')
  writeFileSync(outputFile, '')
  const result = spawnSync(
    'bash',
    ['--noprofile', '--norc', '-c', filterScript()],
    {
      env: {
        PATH: `${dir}:${process.env.PATH}`,
        GITHUB_OUTPUT: outputFile,
        EVENT_NAME: forceRerun ? 'workflow_dispatch' : 'pull_request_target',
        FORCE_RERUN_INPUT: String(forceRerun),
        PR_NUMBER: '21829',
        REQUESTED_TARGETS: targets.join(' '),
        STUB_PRS: JSON.stringify(prs),
        STUB_BRANCHES: branches.join(' ')
      },
      encoding: 'utf8'
    }
  )
  if (result.status !== 0) throw new Error(result.stderr)
  return Object.fromEntries(
    readFileSync(outputFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1)]
      })
  )
}

const mergedCore157: StubPr = {
  state: 'merged',
  head: 'backport-21829-to-core-1.57',
  base: 'core/1.57',
  number: 21880
}

describe('pr-backport filter-targets', () => {
  it('attempts only the new target when an old target was already merged', () => {
    expect(
      runFilter({ targets: ['core/1.57', 'cloud/1.58'], prs: [mergedCore157] })
    ).toMatchObject({
      skip: 'false',
      'pending-targets': 'cloud/1.58',
      'already-exists': 'core/1.57 (merged PR #21880)',
      'all-merged': 'false'
    })
  })

  it('keeps completion false when a merged target and an open target are skipped', () => {
    expect(
      runFilter({
        targets: ['core/1.57', 'cloud/1.58'],
        branches: ['backport-21829-to-cloud-1.58'],
        prs: [
          mergedCore157,
          {
            state: 'open',
            head: 'backport-21829-to-cloud-1.58',
            base: 'cloud/1.58',
            number: 21881
          }
        ]
      })
    ).toMatchObject({ skip: 'true', 'all-merged': 'false' })
  })

  it('skips the run when every target was already merged', () => {
    expect(
      runFilter({ targets: ['core/1.57'], prs: [mergedCore157] })
    ).toMatchObject({
      skip: 'true',
      'pending-targets': '',
      'all-merged': 'true'
    })
  })

  it.for([
    { name: 'a different base', pr: { ...mergedCore157, base: 'main' } },
    { name: 'a fork', pr: { ...mergedCore157, crossRepository: true } }
  ])('ignores a merged PR from $name', ({ pr }) => {
    expect(runFilter({ targets: ['core/1.57'], prs: [pr] })).toMatchObject({
      skip: 'false',
      'pending-targets': 'core/1.57'
    })
  })

  it('retries a merged target when force_rerun is set', () => {
    expect(
      runFilter({
        targets: ['core/1.57'],
        prs: [mergedCore157],
        forceRerun: true
      })
    ).toMatchObject({ skip: 'false', 'pending-targets': 'core/1.57' })
  })

  it('still skips a target whose backport PR is open', () => {
    expect(
      runFilter({
        targets: ['core/1.57'],
        branches: ['backport-21829-to-core-1.57'],
        prs: [{ ...mergedCore157, state: 'open', number: 21881 }]
      })
    ).toMatchObject({
      skip: 'true',
      'all-merged': 'false',
      'already-exists': 'core/1.57 (PR #21881)'
    })
  })

  describe('backports made by hand', () => {
    const handMade: StubPr = {
      state: 'merged',
      head: 'dante/21829-backport-core-1.57',
      base: 'core/1.57',
      number: 22001,
      title: '[backport core/1.57] fix(agent): report a free-text-only answer',
      body: 'Backport of #21829 to core/1.57. The bot cherry-pick conflicted.'
    }

    it('skips a target whose hand-made backport already merged', () => {
      expect(
        runFilter({ targets: ['core/1.57'], prs: [handMade] })
      ).toMatchObject({
        skip: 'true',
        'pending-targets': '',
        'already-exists': 'core/1.57 (merged PR #22001, made by hand)',
        'all-merged': 'true'
      })
    })

    it.for([
      {
        name: 'a "Backport of" line with a pull URL',
        pr: {
          ...handMade,
          head: 'someone/agent-answer-fix',
          body: 'Context first.\n\nBackport of https://github.com/Comfy-Org/ComfyUI_frontend/pull/21829 to core/1.57.'
        }
      },
      {
        name: 'the number in the title',
        pr: {
          ...handMade,
          head: 'someone/agent-answer-fix',
          title: '[core/1.57] fix(agent): answer (#21829)',
          body: ''
        }
      },
      {
        name: 'a head branch that is the only reference',
        pr: { ...handMade, body: 'Same change, adapted to this branch.' }
      },
      {
        name: 'a head branch named backport-<number>',
        pr: {
          ...handMade,
          head: 'oploop-918f-backport-21829-to-core-1.57',
          body: 'PR 21829 conflicted on this branch.'
        }
      },
      {
        name: 'the number in the head branch',
        pr: { ...handMade, body: 'PR 21829 conflicted on this branch.' }
      }
    ])('recognises $name', ({ pr }) => {
      expect(runFilter({ targets: ['core/1.57'], prs: [pr] })).toMatchObject({
        skip: 'true',
        'all-merged': 'true'
      })
    })

    const mentionOnly: StubPr = { ...handMade, head: 'someone/other-fixes' }

    it.for([
      {
        name: 'a title that is not a backport to this target',
        pr: { ...handMade, title: 'fix(agent): follow-up to #21829' }
      },
      {
        name: 'a backport title for another branch',
        pr: { ...handMade, title: '[backport cloud/1.57] fix(agent): answer' }
      },
      {
        name: "the bot's backport of another PR",
        pr: {
          ...handMade,
          head: 'backport-21900-to-core-1.57',
          title: '[backport core/1.57] fix: follow-up (#21829)',
          body: 'Backport of #21829 follow-up.'
        }
      },
      {
        name: 'a ticket key with the same number in the head branch',
        pr: {
          ...handMade,
          head: 'skishore23/be-21829-slash-picker-core-1.57',
          body: 'Fixes the picker (BE-21829).'
        }
      },
      {
        name: 'a title that only mentions the PR',
        pr: {
          ...mentionOnly,
          title: '[core/1.57] follow-up to #21829',
          body: ''
        }
      },
      {
        name: 'a revert of the PR',
        pr: {
          ...handMade,
          title: '[backport core/1.57] Revert "fix(agent): answer (#21829)"'
        }
      },
      {
        name: 'a body that names the PR as left out',
        pr: { ...mentionOnly, body: 'Not included: #21829, it needs #21700.' }
      },
      {
        name: 'a follow-up to the backport',
        pr: {
          ...mentionOnly,
          body: 'Follow-up to the backport of #21829 on this line.'
        }
      },
      {
        name: 'a backport of a PR in another repository',
        pr: {
          ...mentionOnly,
          body: 'Backport of https://github.com/Comfy-Org/ComfyUI/pull/21829.'
        }
      },
      {
        name: 'a longer number sharing the prefix',
        pr: { ...mentionOnly, body: 'Backport of #218290.' }
      },
      {
        name: 'a fork',
        pr: { ...handMade, crossRepository: true }
      },
      {
        name: 'a different base',
        pr: { ...handMade, base: 'core/1.58' }
      }
    ])('ignores $name', ({ pr }) => {
      expect(runFilter({ targets: ['core/1.57'], prs: [pr] })).toMatchObject({
        skip: 'false',
        'pending-targets': 'core/1.57'
      })
    })

    it('matches a target name with capitals', () => {
      expect(
        runFilter({
          targets: ['Release/Hotfix-1'],
          prs: [
            {
              ...handMade,
              base: 'Release/Hotfix-1',
              title: '[backport Release/Hotfix-1] fix(agent): answer'
            }
          ]
        })
      ).toMatchObject({ skip: 'true', 'all-merged': 'true' })
    })

    it('prefers the bot backport when both exist', () => {
      expect(
        runFilter({ targets: ['core/1.57'], prs: [mergedCore157, handMade] })
      ).toMatchObject({ 'already-exists': 'core/1.57 (merged PR #21880)' })
    })

    it('retries a hand-made target when force_rerun is set', () => {
      expect(
        runFilter({ targets: ['core/1.57'], prs: [handMade], forceRerun: true })
      ).toMatchObject({ skip: 'false', 'pending-targets': 'core/1.57' })
    })
  })
})
