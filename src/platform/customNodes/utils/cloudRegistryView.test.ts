import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'

import { cloudRegistryPacks } from './cloudRegistryView'

const prepared: CloudNodeRegistryRevision = {
  revision_id: 'a'.repeat(64),
  name: 'Example',
  pack_id: 'example/x1234567',
  upstream_commit: 'b'.repeat(40),
  source_sha256: 'c'.repeat(64),
  manifest_sha256: 'd'.repeat(64),
  dependency_profile_sha256: 'e'.repeat(64),
  nodes: ['ExampleNode'],
  pinned: true,
  prepared: true,
  node_api_version: 2,
  comfy_verified: false
}
const newer = {
  ...prepared,
  revision_id: 'f'.repeat(64),
  pinned: false,
  prepared: false,
  nodes: ['OtherNode']
}

describe('Cloud registry pack browsing', () => {
  it('groups revisions into one card while keeping the workspace pin selected', () => {
    const packs = cloudRegistryPacks(
      [newer, prepared],
      'all',
      '',
      'all',
      'name'
    )
    expect(packs).toHaveLength(1)
    expect(packs[0].displayRevision).toBe(prepared)
    expect(packs[0].revisions).toEqual([newer, prepared])
  })

  it('searches node names and displays the matching revision, not its prepared sibling', () => {
    const packs = cloudRegistryPacks(
      [prepared, newer],
      'all',
      'othernode',
      'all',
      'name'
    )
    expect(packs[0].displayRevision).toBe(newer)
  })

  it('does not treat a prepared or pinned pack as Comfy Verified', () => {
    expect(
      cloudRegistryPacks([prepared, newer], 'verified', '', 'all', 'name')
    ).toEqual([])
    expect(
      cloudRegistryPacks([prepared, newer], 'unpinned', '', 'all', 'name')[0]
        .displayRevision
    ).toBe(newer)
  })

  it('filters API generation independently of upstream or conversion version', () => {
    const legacy = {
      ...prepared,
      revision_id: '1'.repeat(64),
      name: 'Legacy',
      node_api_version: 1 as const
    }
    expect(
      cloudRegistryPacks([prepared, legacy], 'all', '', '1', 'name').map(
        (pack) => pack.name
      )
    ).toEqual(['Legacy'])
  })
})
