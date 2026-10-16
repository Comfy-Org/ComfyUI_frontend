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

  test.for([
    {
      name: 'forbidden-shared-update.ts',
      message: 'only FollowerDoc.applyRemoteUpdate'
    },
    { name: 'forbidden-map-set.ts', message: 'must not call set' },
    {
      name: 'forbidden-map-alias-delete.ts',
      message: 'must not call delete'
    },
    { name: 'forbidden-array-push.ts', message: 'must not call push' }
  ])('rejects $name', ({ name, message }) => {
    expect(scanFollowerInvariantSource(fixture(name))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining(message) })
      ])
    )
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
      scanFollowerInvariantSources(process.cwd(), FOLLOWER_SOURCE_PATHS)
    ).toEqual([])
  })
})
