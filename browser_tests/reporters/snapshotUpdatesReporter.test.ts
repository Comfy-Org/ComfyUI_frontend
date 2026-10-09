import { describe, expect, it } from 'vitest'

import type { HarvestableTest } from '@e2e/reporters/snapshotUpdatesReporter'
import { collectSnapshotUpdates } from '@e2e/reporters/snapshotUpdatesReporter'

const baseDir = '/repo'
const golden = `${baseDir}/browser_tests/tests/menu.spec.ts-snapshots/menu-open-chromium-linux.png`
const actual = `${baseDir}/test-results/menu-open/menu-open-chromium-linux-actual.png`

type Attachment = HarvestableTest['results'][number]['attachments'][number]

function pngAttachment(name: string, path: string): Attachment {
  return { name, contentType: 'image/png', path }
}

function mismatch(base: string, expectedPath: string, actualPath: string) {
  return [
    pngAttachment(`${base}-expected.png`, expectedPath),
    pngAttachment(`${base}-actual.png`, actualPath),
    pngAttachment(`${base}-diff.png`, `${actualPath}.diff`)
  ]
}

function testCase({
  outcome = 'unexpected',
  results,
  titles = ['', 'chromium', 'menu.spec.ts', 'opens the menu']
}: {
  outcome?: ReturnType<HarvestableTest['outcome']>
  results: Attachment[][]
  titles?: string[]
}): HarvestableTest {
  return {
    titlePath: () => titles,
    outcome: () => outcome,
    results: results.map((attachments) => ({ attachments }))
  }
}

describe('collectSnapshotUpdates', () => {
  it('maps the actual image of a failed assertion onto its golden path', () => {
    const updates = collectSnapshotUpdates(
      [
        testCase({
          results: [mismatch('menu-open-chromium-linux', golden, actual)]
        })
      ],
      baseDir
    )

    expect(updates).toEqual([
      {
        snapshotPath:
          'browser_tests/tests/menu.spec.ts-snapshots/menu-open-chromium-linux.png',
        actualPath: actual,
        test: 'chromium › menu.spec.ts › opens the menu'
      }
    ])
  })

  it('collects every mismatched snapshot of one test', () => {
    const second = golden.replace('menu-open', 'menu-closed')
    const updates = collectSnapshotUpdates(
      [
        testCase({
          results: [
            [
              ...mismatch('menu-open-chromium-linux', golden, actual),
              ...mismatch('menu-closed-chromium-linux', second, `${actual}.2`)
            ]
          ]
        })
      ],
      baseDir
    )

    expect(updates.map((update) => update.snapshotPath)).toEqual([
      'browser_tests/tests/menu.spec.ts-snapshots/menu-open-chromium-linux.png',
      'browser_tests/tests/menu.spec.ts-snapshots/menu-closed-chromium-linux.png'
    ])
  })

  it('reads only the last attempt of a test', () => {
    const retried = `${actual}.retry1`
    const updates = collectSnapshotUpdates(
      [
        testCase({
          results: [
            mismatch('menu-open-chromium-linux', golden, actual),
            mismatch('menu-open-chromium-linux', golden, retried)
          ]
        })
      ],
      baseDir
    )

    expect(updates.map((update) => update.actualPath)).toEqual([retried])
  })

  it.for<{
    name: string
    test: HarvestableTest
  }>([
    {
      name: 'a flaky test that passed on retry',
      test: testCase({
        outcome: 'flaky',
        results: [mismatch('menu-open-chromium-linux', golden, actual), []]
      })
    },
    {
      name: 'a failure expected by test.fail()',
      test: testCase({
        outcome: 'expected',
        results: [mismatch('menu-open-chromium-linux', golden, actual)]
      })
    },
    {
      name: 'a failure without an expected attachment',
      test: testCase({
        results: [
          [pngAttachment('menu-open-chromium-linux-actual.png', actual)]
        ]
      })
    },
    {
      name: 'an expected attachment outside the repository',
      test: testCase({
        results: [
          mismatch(
            'menu-open-chromium-linux',
            '/elsewhere/menu-open-chromium-linux.png',
            actual
          )
        ]
      })
    },
    {
      name: 'attachments without a file path',
      test: testCase({
        results: [
          [
            {
              name: 'menu-open-chromium-linux-expected.png',
              contentType: 'image/png',
              body: Buffer.from('')
            },
            {
              name: 'menu-open-chromium-linux-actual.png',
              contentType: 'image/png',
              body: Buffer.from('')
            }
          ]
        ]
      })
    },
    {
      name: 'a failure with no results',
      test: testCase({ results: [] })
    }
  ])('ignores $name', ({ test }) => {
    expect(collectSnapshotUpdates([test], baseDir)).toEqual([])
  })
})
