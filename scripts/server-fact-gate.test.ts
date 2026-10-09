import { describe, expect, it } from 'vitest'

import type { ChangedRange } from './server-fact-gate-core'
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
      'a deletion right after a finding ends',
      [{ kind: 'deleted', after: 5 }],
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
    ['src/locales/en/main.json', false]
  ] as const)('gates %s: %s', ([path, gated]) => {
    expect(isGatedPath(path)).toBe(gated)
  })
})
