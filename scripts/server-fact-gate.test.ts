import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import type { ChangedRange } from './server-fact-gate-core'
import { lintSnapshot } from './server-fact-oxlint'
import {
  changedRanges,
  findingsOnChangedLines,
  isGatedPath
} from './server-fact-gate-core'

const fileText = [
  "const label = '역할'",
  'const canInvite = computed(',
  '  () =>',
  '    canInviteMembers.value ||',
  '    isPlanEnded.value',
  ')',
  "const isOwner = role === 'owner'"
].join('\n')

function diagnosticCovering(snippet: string, line: number) {
  const index = fileText.indexOf(snippet)
  return {
    filename: 'src/useInvite.ts',
    message: 'server fact',
    labels: [
      {
        span: {
          offset: Buffer.byteLength(fileText.slice(0, index)),
          length: Buffer.byteLength(snippet),
          line
        }
      }
    ]
  }
}

const recombination = diagnosticCovering(
  'canInviteMembers.value ||\n    isPlanEnded.value',
  4
)
const roleLiteral = diagnosticCovering("role === 'owner'", 7)

describe('changedRanges', () => {
  it('maps each file to the new-side lines its hunks add or delete', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -10,2 +10,3 @@ function a() {',
      '@@ -20 +21 @@',
      '@@ -30,2 +31,0 @@',
      'diff --git a/src/new.vue b/src/new.vue',
      '--- /dev/null',
      '+++ b/src/new.vue',
      '@@ -0,0 +1,4 @@'
    ].join('\n')

    expect(Object.fromEntries(changedRanges(diff))).toEqual({
      'src/a.ts': [
        { kind: 'added', start: 10, end: 12 },
        { kind: 'added', start: 21, end: 21 },
        { kind: 'deleted', after: 31 }
      ],
      'src/new.vue': [{ kind: 'added', start: 1, end: 4 }]
    })
  })
})

describe('findingsOnChangedLines', () => {
  it.for<[string, ChangedRange[], number[]]>([
    [
      'a finding that starts on an unchanged line but covers a changed one',
      [{ kind: 'added', start: 5, end: 5 }],
      [4]
    ],
    [
      'a finding whose first line changed',
      [{ kind: 'added', start: 7, end: 7 }],
      [7]
    ],
    [
      'findings entirely on unchanged lines',
      [{ kind: 'added', start: 1, end: 3 }],
      []
    ],
    [
      'a deletion inside a multi-line finding',
      [{ kind: 'deleted', after: 4 }],
      [4]
    ],
    [
      'a deletion on the boundary just before a finding starts',
      [{ kind: 'deleted', after: 3 }],
      [4]
    ],
    [
      'a deletion on the boundary just after a finding ends, even when the finding already existed',
      [{ kind: 'deleted', after: 5 }],
      [4]
    ],
    [
      'no finding for a deletion one line away from either boundary',
      [{ kind: 'deleted', after: 2 }],
      []
    ]
  ])('reports %s', ([, ranges, expectedLines]) => {
    const findings = findingsOnChangedLines(
      [recombination, roleLiteral],
      ranges,
      fileText
    )

    expect(findings.map(({ line }) => line)).toEqual(expectedLines)
  })
})

describe('isGatedPath', () => {
  it.for([
    ['src/platform/workspace/composables/useMembersPanel.ts', true],
    ['src/components/Dialog.vue', true],
    ['apps/billing-web/src/main.ts', true],
    ['src/components/Dialog.test.ts', false],
    ['src/components/Dialog.stories.ts', false],
    ['src/__mocks__/api.ts', false],
    ['src/storybook/mocks/useBillingCapabilities.ts', false],
    ['browser_tests/fixtures/billing.ts', false],
    ['packages/account-core/src/index.ts', false],
    ['src/locales/en/main.json', false],
    ['src/../../outside.ts', false],
    ['src/a/../../../outside.vue', false],
    ['apps/website/src/../../../outside.ts', false],
    ['/src/outside.ts', false]
  ] as const)('gates %s: %s', ([file, gated]) => {
    expect(isGatedPath(file)).toBe(gated)
  })
})

describe('lintSnapshot', () => {
  let outsideDir: string | undefined

  afterEach(() => {
    if (outsideDir) rmSync(outsideDir, { recursive: true, force: true })
    outsideDir = undefined
  })

  it.for([
    [
      'a relative path that climbs out',
      (dir: string) => `src/../../${path.basename(dir)}/escaped.ts`
    ],
    ['an absolute path', (dir: string) => path.join(dir, 'escaped.ts')]
  ] as const)('refuses %s without writing it', ([, fileIn]) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'server-fact-outside-'))
    outsideDir = dir
    const file = fileIn(dir)

    const outcome = lintSnapshot(new Map([[file, 'export const a = 1']]))

    expect(outcome).toEqual({
      ok: false,
      detail: `${file} resolves outside the snapshot`
    })
    expect(existsSync(path.join(dir, 'escaped.ts'))).toBe(false)
  })
})

describe('server-fact gate on a real diff', () => {
  const repoRoot = path.resolve(import.meta.dirname, '..')
  const gatedFile = 'src/useInvite.ts'
  let workDir: string | undefined

  afterEach(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true })
    workDir = undefined
  })

  function runGateAfterEdit(before: string[], after: string[]) {
    const dir = mkdtempSync(path.join(tmpdir(), 'server-fact-gate-'))
    workDir = dir
    const run = (...args: string[]) =>
      execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
    run('init', '-q')
    run('config', 'user.email', 'gate@test.invalid')
    run('config', 'user.name', 'gate')
    for (const linked of ['node_modules', 'tools']) {
      symlinkSync(path.join(repoRoot, linked), path.join(dir, linked))
    }
    writeFileSync(path.join(dir, '.git/info/exclude'), 'node_modules\ntools\n')
    mkdirSync(path.join(dir, 'src'))
    writeFileSync(path.join(dir, gatedFile), before.join('\n'))
    run('add', '.')
    run('commit', '-q', '-m', 'base')
    writeFileSync(path.join(dir, gatedFile), after.join('\n'))
    return spawnSync(
      path.join(repoRoot, 'node_modules/.bin/tsx'),
      [path.join(repoRoot, 'scripts/server-fact-gate.ts'), '--base', 'HEAD'],
      { cwd: dir, encoding: 'utf8' }
    )
  }

  it('reports a recombination exposed by deleting only its pendingServerFact wrapper lines', () => {
    const wrapped = [
      'const { canInviteMembers } = useBillingCapabilities()',
      'export const canInvite =',
      '  pendingServerFact(',
      "    'BE-1',",
      '    canInviteMembers.value || isPlanEnded.value',
      '  )',
      'export const ready = true',
      ''
    ]
    const unwrapped = wrapped.filter(
      (line) => !/pendingServerFact|BE-1|^ {2}\)$/.test(line)
    )

    const result = runGateAfterEdit(wrapped, unwrapped)

    expect(result.stderr).toContain(`${gatedFile}:3 `)
    expect(result.status).toBe(1)
  })

  it('passes an existing finding when the only deletion is a line away from it', () => {
    const before = [
      'const { canInviteMembers } = useBillingCapabilities()',
      'export const canInvite =',
      '  canInviteMembers.value || isPlanEnded.value',
      'export const ready = true',
      'export const unused = false',
      ''
    ]
    const after = before.filter((line) => !line.includes('unused'))

    const result = runGateAfterEdit(before, after)

    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })
})
