import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import {
  compareLines,
  DEFAULT_MAX_PER_RUN,
  labelsToNote,
  retirementMarker,
  runRetirement,
  groupByPr,
  labelPath,
  oldestLine,
  parseLine,
  parseTargetLabel,
  planRetirement,
  reportLine,
  retirementComment
} from './retire-backport-labels'
import type { PrRef, RetireDeps } from './retire-backport-labels'

const LABELS = [
  'needs-backport',
  'backport',
  'cloud/1.52',
  'cloud/1.53',
  'cloud/1.54',
  'cloud/1.55',
  'cloud/1.56',
  'cloud/1.57',
  'core/1.52',
  'core/1.53',
  'core/1.54',
  'core/1.55',
  'core/1.56',
  'core/1.57',
  'released:cloud',
  'retired/cloud/1.40'
]

describe('parseTargetLabel', () => {
  it('reads core and cloud target labels', () => {
    expect(parseTargetLabel('cloud/1.55')).toEqual({
      product: 'cloud',
      line: { major: 1, minor: 55 }
    })
    expect(parseTargetLabel('core/2.0')).toEqual({
      product: 'core',
      line: { major: 2, minor: 0 }
    })
  })

  it('ignores every other label, including look-alikes', () => {
    for (const name of [
      'needs-backport',
      'released:cloud',
      'retired/cloud/1.40',
      'cloud/1.55.1',
      'core/1',
      'branch:core/1.55',
      '1.55'
    ]) {
      expect(parseTargetLabel(name)).toBeNull()
    }
  })
})

describe('compareLines', () => {
  it('orders by minor numerically, not as text', () => {
    expect(compareLines(parseLine('1.9')!, parseLine('1.10')!)).toBeLessThan(0)
    expect(compareLines(parseLine('2.0')!, parseLine('1.99')!)).toBeGreaterThan(
      0
    )
  })
})

describe('oldestLine', () => {
  it('keeps the oldest line when a SHA is on more than one branch', () => {
    // A fork-point commit is on the cut line and every later one.
    expect(oldestLine([parseLine('1.58')!, parseLine('1.57')!])).toEqual(
      parseLine('1.57')
    )
  })

  it('returns null when there is nothing to read', () => {
    expect(oldestLine([])).toBeNull()
  })
})

describe('planRetirement', () => {
  it('retires cloud lines older than the stable line, oldest first', () => {
    expect(
      planRetirement({
        labels: LABELS,
        product: 'cloud',
        keepFrom: parseLine('1.56')!
      }).retire
    ).toEqual(['cloud/1.52', 'cloud/1.53', 'cloud/1.54', 'cloud/1.55'])
  })

  it('treats core and cloud independently', () => {
    expect(
      planRetirement({
        labels: LABELS,
        product: 'core',
        keepFrom: parseLine('1.55')!
      }).retire
    ).toEqual(['core/1.52', 'core/1.53', 'core/1.54'])
  })

  it('retires nothing when the live line is the oldest label', () => {
    expect(
      planRetirement({
        labels: LABELS,
        product: 'core',
        keepFrom: parseLine('1.52')!
      }).retire
    ).toEqual([])
  })

  it('keeps the live line itself and every newer line', () => {
    const { retire } = planRetirement({
      labels: LABELS,
      product: 'cloud',
      keepFrom: parseLine('1.57')!,
      maxPerRun: 5
    })
    expect(retire).not.toContain('cloud/1.57')
    expect(retire).toHaveLength(5)
  })

  it('refuses to act when the live line is past every label', () => {
    // A bad signal or branch mapping must not delete every label.
    expect(() =>
      planRetirement({
        labels: LABELS,
        product: 'cloud',
        keepFrom: parseLine('1.60')!
      })
    ).toThrow(/refusing/)
  })
})

describe('retirementComment', () => {
  it('names the retired label and the line to retarget to', () => {
    const body = retirementComment(['cloud/1.55'], 'cloud', '1.56')
    expect(body).toContain('`cloud/1.55` no longer ships')
    expect(body).toContain('cloud/1.56 or newer')
  })

  it('lists every retired label in one comment', () => {
    const body = retirementComment(['core/1.52', 'core/1.53'], 'core', '1.55')
    expect(body).toContain('`core/1.52`, `core/1.53` no longer ship')
  })
})

describe('groupByPr', () => {
  it('gives each PR one entry holding all of its retired labels', () => {
    const a = { number: 15602 }
    const b = { number: 16121 }
    expect(
      groupByPr([
        { label: 'cloud/1.52', pr: a },
        { label: 'cloud/1.52', pr: b },
        { label: 'cloud/1.53', pr: a }
      ])
    ).toEqual([
      { pr: a, labels: ['cloud/1.52', 'cloud/1.53'] },
      { pr: b, labels: ['cloud/1.52'] }
    ])
  })
})

describe('labelPath', () => {
  it('encodes the slash for the labels REST endpoint', () => {
    expect(labelPath('cloud/1.55')).toBe('cloud%2F1.55')
  })
})

describe('reportLine', () => {
  const pr = (n: number) => ({
    number: n,
    title: `PR ${n}`,
    html_url: `https://github.com/o/r/pull/${n}`
  })

  it('reports a bare deletion', () => {
    expect(
      reportLine({ label: 'cloud/1.52', waiting: [], open: [] }, false)
    ).toBe('• Deleted `cloud/1.52`')
  })

  it('says what a dry run would do, with PR links', () => {
    expect(
      reportLine(
        { label: 'cloud/1.54', waiting: [pr(18949)], open: [pr(19300)] },
        true
      )
    ).toBe(
      '• Would delete `cloud/1.54`; would comment on <https://github.com/o/r/pull/18949|#18949>; still open against the branch: <https://github.com/o/r/pull/19300|#19300>'
    )
  })
})

describe('planRetirement cap', () => {
  const labels = [
    'cloud/1.50',
    'cloud/1.51',
    'cloud/1.52',
    'cloud/1.53',
    'cloud/1.54',
    'cloud/1.55'
  ]

  it('allows exactly the cap, which covers the first run backlog', () => {
    expect(
      planRetirement({ labels, product: 'cloud', keepFrom: parseLine('1.54')! })
        .retire
    ).toHaveLength(DEFAULT_MAX_PER_RUN)
  })

  it('refuses to delete more than the cap in one run', () => {
    expect(() =>
      planRetirement({ labels, product: 'cloud', keepFrom: parseLine('1.55')! })
    ).toThrow(/more than the 4 allowed per run/)
  })

  it('takes a deliberate higher cap', () => {
    expect(
      planRetirement({
        labels,
        product: 'cloud',
        keepFrom: parseLine('1.55')!,
        maxPerRun: 5
      }).retire
    ).toHaveLength(5)
  })
})

describe('labelsToNote', () => {
  it('skips labels an earlier run already commented on', () => {
    const earlier = retirementComment(['cloud/1.52'], 'cloud', '1.56')
    expect(earlier).toContain(retirementMarker('cloud/1.52'))
    expect(
      labelsToNote(['unrelated', earlier], ['cloud/1.52', 'cloud/1.53'])
    ).toEqual(['cloud/1.53'])
  })
})

// --- Orchestration, with fake I/O --------------------------------------------

const SHA = 'a'.repeat(40)
const pr = (n: number): PrRef => ({
  number: n,
  title: `PR ${n}`,
  html_url: `https://github.com/o/r/pull/${n}`
})

function fakeDeps(overrides: Partial<RetireDeps> = {}) {
  const writes: string[] = []
  const deps: RetireDeps = {
    servedCloudSha: async () => SHA,
    cloudBranchesContaining: () => ['1.56', '1.57'],
    latestComfyUITag: async () => 'v0.41.0',
    requirementsAt: async () => 'comfyui-frontend-package==1.55.17\n',
    listLabels: () => LABELS,
    prsWaitingOn: (label) =>
      label === 'cloud/1.55' ? [pr(1), pr(2)] : [pr(1)],
    openPrsAgainst: () => [],
    commentBodies: () => [],
    postComment: (n, body) =>
      writes.push(
        `comment #${n}: ${body
          .split('\n')
          .filter((l) => l.startsWith('<!--'))
          .join(' ')}`
      ),
    deleteLabel: (label) => writes.push(`delete ${label}`),
    ...overrides
  }
  return { deps, writes }
}

describe('runRetirement: fails closed before any write', () => {
  const cases: [string, Partial<RetireDeps>, 'cloud' | 'core'][] = [
    [
      'no x-frontend-version header',
      { servedCloudSha: async () => null },
      'cloud'
    ],
    [
      'a header that is not a SHA',
      { servedCloudSha: async () => 'nightly' },
      'cloud'
    ],
    [
      'a SHA on no cloud/* branch',
      { cloudBranchesContaining: () => [] },
      'cloud'
    ],
    [
      'the cloud signal read throwing',
      {
        servedCloudSha: async () => {
          throw new Error('HTTP 503')
        }
      },
      'cloud'
    ],
    ['no ComfyUI release', { latestComfyUITag: async () => null }, 'core'],
    ['no frontend pin', { requirementsAt: async () => 'torch\n' }, 'core'],
    [
      'a live line past every label',
      { cloudBranchesContaining: () => ['1.60'] },
      'cloud'
    ],
    [
      'more deletions than the cap',
      { listLabels: () => [...LABELS, 'cloud/1.48', 'cloud/1.49'] },
      'cloud'
    ]
  ]

  for (const [name, overrides, product] of cases) {
    it(`writes nothing on ${name}`, async () => {
      const { deps, writes } = fakeDeps(overrides)
      await expect(
        runRetirement({ product, dryRun: false }, deps)
      ).rejects.toThrow()
      expect(writes).toEqual([])
    })
  }
})

describe('runRetirement: writes', () => {
  it('posts every comment before deleting any label, one comment per PR', async () => {
    const { deps, writes } = fakeDeps()
    const { retired } = await runRetirement(
      { product: 'cloud', dryRun: false },
      deps
    )

    expect(retired).toEqual([
      'cloud/1.52',
      'cloud/1.53',
      'cloud/1.54',
      'cloud/1.55'
    ])
    const lastComment = writes.findLastIndex((w) => w.startsWith('comment'))
    const firstDelete = writes.findIndex((w) => w.startsWith('delete'))
    expect(lastComment).toBeLessThan(firstDelete)
    expect(writes.filter((w) => w.startsWith('comment #1'))).toHaveLength(1)
    expect(writes.filter((w) => w.startsWith('comment #2'))).toHaveLength(1)
  })

  it('does not comment again on a PR an earlier run already covered', async () => {
    const earlier = retirementComment(
      ['cloud/1.52', 'cloud/1.53', 'cloud/1.54', 'cloud/1.55'],
      'cloud',
      '1.56'
    )
    const { deps, writes } = fakeDeps({
      commentBodies: (n) => (n === 1 ? [earlier] : [])
    })
    await runRetirement({ product: 'cloud', dryRun: false }, deps)
    expect(writes.some((w) => w.startsWith('comment #1'))).toBe(false)
    expect(writes.some((w) => w.startsWith('comment #2'))).toBe(true)
    expect(writes.filter((w) => w.startsWith('delete'))).toHaveLength(4)
  })

  it('keeps the oldest pinned core line', async () => {
    const { deps } = fakeDeps({
      requirementsAt: async (ref) =>
        `comfyui-frontend-package==${ref === 'master' ? '1.56.2' : '1.55.17'}\n`
    })
    const { retired } = await runRetirement(
      { product: 'core', dryRun: true },
      deps
    )
    expect(retired).toEqual(['core/1.52', 'core/1.53', 'core/1.54'])
  })

  it('writes nothing on a dry run', async () => {
    const { deps, writes } = fakeDeps()
    const { lines } = await runRetirement(
      { product: 'cloud', dryRun: true },
      deps
    )
    expect(lines[0]).toMatch(/^• Would delete `cloud\/1\.52`/)
    expect(writes).toEqual([])
  })
})

describe('GitHub access stays on REST', () => {
  // `gh pr edit` and friends need `read:org`, which the workflow token lacks
  // (see backport-token-scopes.test.ts).
  it('the script only shells out to gh through `gh api`', () => {
    const source = readFileSync(
      'scripts/cicd/retire-backport-labels.ts',
      'utf8'
    )
    expect(source.match(/run\('gh'/g)).toEqual(["run('gh'"])
    expect(source).toContain("run('gh', ['api', ...args])")
  })

  it('the workflow runs no gh pr, issue or label subcommands', () => {
    const workflow = parse(
      readFileSync('.github/workflows/release-label-retire.yaml', 'utf8')
    ) as { jobs: Record<string, { steps: { run?: string }[] }> }
    const runs = Object.values(workflow.jobs)
      .flatMap((job) => job.steps)
      .map((step) => step.run ?? '')
    for (const script of runs) {
      expect(script).not.toMatch(/\bgh\s+(pr|issue|label)\b/)
    }
  })
})
