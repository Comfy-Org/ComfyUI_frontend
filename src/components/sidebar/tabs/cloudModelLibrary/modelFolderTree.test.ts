import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import { buildFolderNode } from './modelFolderTree'
import type { TreeEntry } from './modelFolderTree'

function entry(subpath: string, name: string): TreeEntry {
  const asset: AssetItem = { id: name, name, tags: ['models'] }
  return { subpath, item: { kind: 'asset', asset } }
}

describe('buildFolderNode', () => {
  it('nests subpaths as folders with rolled-up counts', () => {
    const root = buildFolderNode(
      'loras',
      'LoRAs',
      [
        entry('', 'detail_tweaker'),
        entry('anime/ghibli', 'totoro'),
        entry('anime/ghibli', 'mononoke'),
        entry('anime/naruto', 'sage_mode'),
        entry('movies/transformers', 'optimus')
      ],
      'nameAsc',
      false
    )
    expect(root.totalCount).toBe(5)
    expect(root.providers[0].items).toHaveLength(1)
    expect(root.children.map((c) => c.name)).toEqual(['anime', 'movies'])
    const anime = root.children[0]
    expect(anime.totalCount).toBe(3)
    expect(anime.children.map((c) => c.name)).toEqual(['ghibli', 'naruto'])
    expect(anime.children[0].totalCount).toBe(2)
  })

  it('builds stable expansion ids from the path', () => {
    const root = buildFolderNode(
      'loras',
      'LoRAs',
      [entry('anime/ghibli', 'totoro')],
      'nameAsc',
      false
    )
    expect(root.children[0].id).toBe('loras/anime')
    expect(root.children[0].children[0].id).toBe('loras/anime/ghibli')
  })

  it('sorts sibling folders alphabetically regardless of entry order', () => {
    const root = buildFolderNode(
      'dir:checkpoints',
      'checkpoints',
      [entry('zeta', 'z'), entry('Alpha', 'a'), entry('mid', 'm')],
      'recent',
      false
    )
    expect(root.children.map((c) => c.name)).toEqual(['Alpha', 'mid', 'zeta'])
  })
})
