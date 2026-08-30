import { SCHEMA_VERSION, mint } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

const reportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/reportError', () => ({ reportError }))

import { FollowerSchemaError, assertReadableSchema } from './schemaGuard'

function docAtVersion(version: unknown): Y.Doc {
  const doc = new Y.Doc()
  // Simulating the HOST side of the wire: a foreign writer sets meta through
  // the raw Y api, not through this package's typed accessors.
  doc.getMap('meta').set('schema_version', version)
  return doc
}

describe('assertReadableSchema (KA-11, fail-closed on read)', () => {
  beforeEach(() => {
    reportError.mockClear()
  })

  it('accepts a doc the shared package minted at the build version', () => {
    const doc = mint({ nodes: [], links: [] }, { types: {} })
    expect(() => assertReadableSchema(doc)).not.toThrow()
  })

  it('throws a typed error carrying the newer version it found', () => {
    const doc = docAtVersion(SCHEMA_VERSION + 1)
    let thrown: unknown
    try {
      assertReadableSchema(doc)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(FollowerSchemaError)
    const schemaError = thrown as FollowerSchemaError
    expect(schemaError.found).toBe(SCHEMA_VERSION + 1)
    expect(schemaError.message).toContain('KA-11')
    expect(schemaError.message).toContain(`v${SCHEMA_VERSION}`)
  })

  it('fails closed on a doc with no schema version at all', () => {
    const doc = new Y.Doc()
    expect(() => assertReadableSchema(doc)).toThrow(FollowerSchemaError)
  })

  it('fails closed on a version of the wrong type (strict equality)', () => {
    const doc = docAtVersion(String(SCHEMA_VERSION))
    expect(() => assertReadableSchema(doc)).toThrow(FollowerSchemaError)
  })

  it('routes the refusal through the central invariant channel', () => {
    expect(() => assertReadableSchema(docAtVersion(99))).toThrow(
      FollowerSchemaError
    )
    expect(reportError).toHaveBeenCalledWith(expect.any(FollowerSchemaError), {
      errorType: 'agent_crdt_schema_rejection',
      context: { found: 99, expected: SCHEMA_VERSION }
    })
  })

  it('never writes the doc it refuses (KA-6: the follower is read-only)', () => {
    const doc = docAtVersion(99)
    const before = Y.encodeStateVector(doc)
    expect(() => assertReadableSchema(doc)).toThrow(FollowerSchemaError)
    expect(Y.encodeStateVector(doc)).toEqual(before)
  })
})
