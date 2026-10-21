import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test } from 'vitest'

import {
  FOLLOWER_SOURCE_PATHS,
  scanFollowerInvariantSource,
  scanFollowerInvariantSources
} from './check-follower-invariants'

const fixture = (name: string) => ({
  path: `src/workbench/extensions/agent/crdt/${name}`,
  contents: readFileSync(
    join(import.meta.dirname, '__fixtures__', 'follower-invariants', name),
    'utf8'
  )
})

describe('follower invariant guard', () => {
  test('accepts the sole host-to-follower integration seam', () => {
    expect(scanFollowerInvariantSource(fixture('followerDoc.ts'))).toEqual([])
  })

  test('accepts a plain local that shares a name with a shared-document value', () => {
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

  test('fails closed when a required source is missing', () => {
    expect(
      scanFollowerInvariantSources(import.meta.dirname, [
        'missing-follower-source.ts'
      ])
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'required follower source is missing'
        })
      ])
    )
  })

  test('fails closed when a source cannot be parsed', () => {
    expect(
      scanFollowerInvariantSource({
        path: 'src/workbench/extensions/agent/crdt/malformed.ts',
        contents: 'const ='
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining(
            'cannot inspect malformed TypeScript'
          )
        })
      ])
    )
  })

  test('accepts the current follower source set', () => {
    expect(
      scanFollowerInvariantSources(
        join(import.meta.dirname, '..'),
        FOLLOWER_SOURCE_PATHS
      )
    ).toEqual([])
  })
})
