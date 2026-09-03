import { describe, expect, it } from 'vitest'

import type { Pack } from './cloudNodes'

import { toGridPack } from './cloudNodes'

describe('toGridPack', () => {
  it('keeps grid fields and excludes detail-only metadata', () => {
    const pack: Pack = {
      id: 'pack-id',
      registryId: 'registry-id',
      displayName: 'Pack name',
      description: 'Pack description',
      bannerUrl: 'https://example.com/banner.webp',
      iconUrl: 'https://example.com/icon.webp',
      repoUrl: 'https://example.com/repo',
      publisher: { id: 'publisher-id', name: 'Publisher' },
      downloads: 42,
      githubStars: 99,
      latestVersion: '1.2.3',
      license: 'MIT',
      lastUpdated: '2026-08-01T00:00:00Z',
      supportedOs: ['linux'],
      supportedAccelerators: ['cuda'],
      nodes: [
        {
          name: 'NodeName',
          displayName: 'Node name',
          category: 'image',
          description: 'Node description',
          deprecated: true,
          experimental: true
        }
      ]
    }

    expect(toGridPack(pack)).toEqual({
      id: 'pack-id',
      displayName: 'Pack name',
      description: 'Pack description',
      bannerUrl: 'https://example.com/banner.webp',
      iconUrl: 'https://example.com/icon.webp',
      repoUrl: 'https://example.com/repo',
      downloads: 42,
      lastUpdated: '2026-08-01T00:00:00Z',
      nodes: [
        {
          name: 'NodeName',
          displayName: 'Node name',
          category: 'image'
        }
      ]
    })
  })
})
