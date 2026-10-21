import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, onTestFinished, test } from 'vitest'

import {
  scanFollowerInvariantSource,
  scanFollowerInvariantSources
} from './check-follower-invariants'

const FOLLOWER_CORE = 'src/workbench/extensions/agent/crdt'

function fixtureContents(name: string): string {
  return readFileSync(
    join(import.meta.dirname, '__fixtures__', 'follower-invariants', name),
    'utf8'
  )
}

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'follower-invariants-'))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  return root
}

function fixture(name: string, scannedAs = name) {
  return {
    path: `${FOLLOWER_CORE}/${scannedAs}`,
    contents: fixtureContents(name)
  }
}

describe('follower invariant guard', () => {
  test('accepts the sole host-to-follower integration seam', () => {
    expect(scanFollowerInvariantSource(fixture('followerDoc.ts'))).toEqual([])
  })

  test('accepts plain locals that share a name with a shared-document value', () => {
    expect(
      scanFollowerInvariantSource(fixture('allowed-shadowed-local.ts'))
    ).toEqual([])
  })

  test.for([
    {
      name: 'forbidden-shared-update.ts',
      message: 'only FollowerDoc.applyRemoteUpdate',
      line: 5
    },
    { name: 'forbidden-map-set.ts', message: 'must not call set', line: 5 },
    {
      name: 'forbidden-map-alias-delete.ts',
      message: 'must not call delete',
      line: 6
    },
    { name: 'forbidden-array-push.ts', message: 'must not call push', line: 6 },
    {
      name: 'forbidden-aliased-update.ts',
      message: 'only FollowerDoc.applyRemoteUpdate',
      line: 5
    },
    {
      name: 'forbidden-shared-update-v2.ts',
      message: 'only FollowerDoc.applyRemoteUpdate',
      line: 5
    },
    {
      name: 'forbidden-local-update-alias.ts',
      message: 'only FollowerDoc.applyRemoteUpdate',
      line: 5
    },
    {
      name: 'forbidden-destructured-update-alias.ts',
      message: 'only FollowerDoc.applyRemoteUpdate',
      line: 5
    },
    {
      name: 'forbidden-text-apply-delta.ts',
      message: 'must not call applyDelta',
      line: 5
    },
    {
      name: 'forbidden-typed-text-apply-delta.ts',
      message: 'must not call applyDelta',
      line: 4
    },
    {
      name: 'forbidden-optional-text-apply-delta.ts',
      message: 'must not call applyDelta',
      line: 4
    },
    {
      name: 'forbidden-element-access-set.ts',
      message: 'must not call set',
      line: 5
    },
    {
      name: 'forbidden-element-access-receiver.ts',
      message: 'must not call set',
      line: 4
    },
    {
      name: 'forbidden-satisfies-set.ts',
      message: 'must not call set',
      line: 5
    },
    {
      name: 'forbidden-destructured-doc-set.ts',
      message: 'must not call set',
      line: 6
    },
    {
      name: 'forbidden-accessor-delete.ts',
      message: 'must not call delete',
      line: 5
    },
    {
      name: 'forbidden-instanceof-set.ts',
      message: 'must not call set',
      line: 4
    },
    {
      name: 'forbidden-this-field-delete.ts',
      message: 'must not call delete',
      line: 11
    },
    {
      name: 'forbidden-for-each-set.ts',
      message: 'must not call set',
      line: 4
    },
    { name: 'forbidden-for-of-set.ts', message: 'must not call set', line: 4 },
    {
      name: 'forbidden-accessor-alias-delete.ts',
      message: 'must not call delete',
      line: 6
    }
  ])('rejects $name', ({ name, message, line }) => {
    expect(scanFollowerInvariantSource(fixture(name))).toEqual([
      expect.objectContaining({
        line,
        message: expect.stringContaining(message)
      })
    ])
  })

  test('rejects a bracketed applyUpdate call', () => {
    // Inline because the repo's lint rejects computed namespace access in a
    // source file, which is exactly the shape this pins.
    expect(
      scanFollowerInvariantSource({
        path: `${FOLLOWER_CORE}/bracketed-update.ts`,
        contents:
          "import * as Y from 'yjs'\nY['applyUpdate'](new Y.Doc(), bytes)\n"
      })
    ).toEqual([
      expect.objectContaining({
        line: 2,
        message: expect.stringContaining('only FollowerDoc.applyRemoteUpdate')
      })
    ])
  })

  test.for([
    {
      name: 'followerDoc.ts',
      scannedAs: 'remoteDoc.ts',
      line: 7
    },
    {
      name: 'forbidden-seam-other-method.ts',
      scannedAs: 'followerDoc.ts',
      line: 11
    },
    {
      name: 'forbidden-seam-other-target.ts',
      scannedAs: 'followerDoc.ts',
      line: 8
    },
    {
      name: 'forbidden-seam-other-class.ts',
      scannedAs: 'followerDoc.ts',
      line: 7
    }
  ])(
    'rejects the seam shape in $name scanned as $scannedAs',
    ({ name, scannedAs, line }) => {
      expect(scanFollowerInvariantSource(fixture(name, scannedAs))).toEqual([
        expect.objectContaining({
          line,
          message: expect.stringContaining('only FollowerDoc.applyRemoteUpdate')
        })
      ])
    }
  )

  test('scans every non-test follower-core module, not a fixed list', () => {
    const root = temporaryRoot()
    const core = join(root, FOLLOWER_CORE)
    mkdirSync(core, { recursive: true })
    const forbidden = fixtureContents('forbidden-map-set.ts')
    writeFileSync(
      join(core, 'followerDoc.ts'),
      fixtureContents('followerDoc.ts')
    )
    writeFileSync(join(core, 'newFollowerWriter.ts'), forbidden)
    writeFileSync(join(core, 'newFollowerWriter.test.ts'), forbidden)
    writeFileSync(join(core, 'mergeScenarios.ts'), forbidden)

    expect(scanFollowerInvariantSources(root)).toEqual([
      {
        path: join(core, 'newFollowerWriter.ts'),
        line: 5,
        column: 1,
        message: 'follower code must not call set on a shared document value'
      }
    ])
  })

  test('fails closed when the integration seam is missing', () => {
    const root = temporaryRoot()
    expect(scanFollowerInvariantSources(root)).toEqual([
      {
        path: `${FOLLOWER_CORE}/followerDoc.ts`,
        line: 1,
        column: 1,
        message: 'required follower source is missing'
      }
    ])
  })

  test('fails closed when a source cannot be parsed', () => {
    expect(
      scanFollowerInvariantSource({
        path: `${FOLLOWER_CORE}/malformed.ts`,
        contents: 'const ='
      })
    ).toEqual([
      {
        path: `${FOLLOWER_CORE}/malformed.ts`,
        line: 1,
        column: 7,
        message:
          'cannot inspect malformed TypeScript: Variable declaration expected.'
      }
    ])
  })

  test('accepts the current follower-core sources', () => {
    expect(
      scanFollowerInvariantSources(join(import.meta.dirname, '..'))
    ).toEqual([])
  })
})
