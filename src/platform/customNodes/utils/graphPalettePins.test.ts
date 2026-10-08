import type { CloudNodeRegistry } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'

import { graphPalettePinPlan } from './graphPalettePins'

function fixture(): CloudNodeRegistry {
  return {
    corpus_commit: 'a'.repeat(40),
    pins: [],
    revisions: [
      {
        revision_id: 'b'.repeat(64),
        name: 'Pack',
        pack_id: 'pack/x1234567',
        upstream_commit: 'c'.repeat(40),
        source_sha256: 'd'.repeat(64),
        manifest_sha256: 'e'.repeat(64),
        dependency_profile_sha256: 'f'.repeat(64),
        nodes: ['CustomA', 'CustomB'],
        node_api_version: 2,
        comfy_verified: false,
        pinned: false,
        prepared: false
      }
    ]
  }
}

describe('graphPalettePinPlan', () => {
  it('adds each graph pack once, including muted nodes, without requiring preparation', () => {
    const graph = {
      nodes: [
        { id: 1, type: 'CustomA', mode: 2 },
        { id: 2, type: 'CustomB' },
        { id: 3, type: 'CustomA' },
        { id: 4, type: 'Native' }
      ]
    }
    expect(graphPalettePinPlan(graph, fixture(), {})).toEqual({
      revisionIds: ['b'.repeat(64)],
      unresolved: []
    })
  })

  it('includes instantiated nested subgraphs but not unused library definitions', () => {
    const graph = {
      nodes: [{ id: 1, type: 'outer' }],
      definitions: {
        subgraphs: [
          {
            id: 'outer',
            name: 'Outer',
            inputNode: {},
            outputNode: {},
            nodes: [{ id: 2, type: 'inner' }],
            definitions: {
              subgraphs: [
                {
                  id: 'inner',
                  name: 'Inner',
                  inputNode: {},
                  outputNode: {},
                  nodes: [{ id: 3, type: 'CustomA' }]
                },
                {
                  id: 'unused',
                  name: 'Unused',
                  inputNode: {},
                  outputNode: {},
                  nodes: [{ id: 4, type: 'Ambiguous' }]
                }
              ]
            }
          }
        ]
      }
    }
    const catalog = fixture()
    catalog.revisions.push(
      ...[1, 2].map((number) => ({
        ...catalog.revisions[0],
        revision_id: String(number).repeat(64),
        nodes: ['Ambiguous']
      }))
    )
    expect(graphPalettePinPlan(graph, catalog, {})).toEqual({
      revisionIds: ['b'.repeat(64)],
      unresolved: []
    })
  })

  it('preserves existing selections and ignores native definitions even if a pack claims their IDs', () => {
    const catalog = fixture()
    catalog.revisions[0].pinned = true
    expect(
      graphPalettePinPlan({ nodes: [{ id: 1, type: 'CustomA' }] }, catalog, {})
    ).toEqual({ revisionIds: [], unresolved: [] })
    catalog.revisions[0].pinned = false
    expect(
      graphPalettePinPlan({ nodes: [{ id: 1, type: 'CustomA' }] }, catalog, {
        CustomA: { python_module: 'nodes' }
      })
    ).toEqual({ revisionIds: [], unresolved: [] })
  })

  it('uses trusted graph definitions to resolve duplicate owners/versions, not untrusted workflow properties', () => {
    const catalog = fixture()
    catalog.revisions.push({
      ...catalog.revisions[0],
      revision_id: '1'.repeat(64)
    })
    const graph = {
      nodes: [
        {
          id: 1,
          type: 'CustomA',
          properties: { comfy_cloud_revision_id: '1'.repeat(64) }
        }
      ]
    }
    expect(
      graphPalettePinPlan(graph, catalog, {
        CustomA: {
          python_module: 'custom_nodes.cloud_registry.' + 'b'.repeat(64)
        }
      })
    ).toEqual({ revisionIds: ['b'.repeat(64)], unresolved: [] })
    expect(graphPalettePinPlan(graph, catalog, {})).toEqual({
      revisionIds: [],
      unresolved: ['CustomA']
    })
  })

  it('does not pin V1 or incomplete-provenance packs', () => {
    const catalog = fixture()
    catalog.revisions[0] = { ...catalog.revisions[0], node_api_version: 1 }
    expect(
      graphPalettePinPlan({ nodes: [{ id: 1, type: 'CustomA' }] }, catalog, {})
    ).toEqual({ revisionIds: [], unresolved: [] })
    catalog.revisions[0] = { ...catalog.revisions[0], node_api_version: 2 }
    catalog.revisions[0].upstream_commit = ''
    expect(
      graphPalettePinPlan({ nodes: [{ id: 1, type: 'CustomA' }] }, catalog, {})
    ).toEqual({ revisionIds: [], unresolved: ['CustomA'] })
  })
})
