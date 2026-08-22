import { describe, expect, it } from 'vitest'

import {
  parseDeployRef,
  parseShardRows,
  registryArtifactUrl,
  torchConstraints
} from './custom-node-install'

describe('custom-node installer input policy', () => {
  it('parses the shard contract', () => {
    expect(
      parseShardRows('pack-a\tpack-a@1.2.3\npack-b\tpack-b@2.0.0\n')
    ).toEqual([
      { pack: 'pack-a', ref: 'pack-a@1.2.3' },
      { pack: 'pack-b', ref: 'pack-b@2.0.0' }
    ])
    expect(() => parseShardRows('../pack\tpack@1.0.0')).toThrow(/unsafe/)
    expect(() => parseShardRows('')).toThrow(/owns no packs/)
  })

  it('accepts only immutable GitHub or registry refs', () => {
    const sha = 'a'.repeat(40)
    expect(parseDeployRef(`https://github.com/owner/repo@${sha}`)).toEqual({
      kind: 'git',
      repository: 'https://github.com/owner/repo',
      sha
    })
    expect(parseDeployRef('pack-id@1.2.3')).toEqual({
      kind: 'registry',
      id: 'pack-id',
      version: '1.2.3'
    })
    expect(() => parseDeployRef('https://evil.example/repo@main')).toThrow(
      /github/
    )
    expect(() => parseDeployRef('https://github.com/owner/repo@main')).toThrow(
      /full commit/
    )
  })

  it('accepts registry artifacts only from the CDN', () => {
    expect(
      registryArtifactUrl({ downloadUrl: 'https://cdn.comfy.org/pack.zip' })
    ).toBe('https://cdn.comfy.org/pack.zip')
    expect(() =>
      registryArtifactUrl({ downloadUrl: 'https://evil.example/pack.zip' })
    ).toThrow(/cdn\.comfy\.org/)
    expect(() =>
      registryArtifactUrl({ downloadUrl: 'https://cdn.comfy.org:444/pack.zip' })
    ).toThrow(/cdn\.comfy\.org/)
    expect(() => registryArtifactUrl({})).toThrow(/downloadUrl/)
  })

  it('pins only the installed torch stack', () => {
    expect(
      torchConstraints(
        'numpy==2.0.0\ntorch==2.8.0\ntorchvision==0.23.0\nTorchaudio==2.8.0\n'
      )
    ).toBe('torch==2.8.0\ntorchvision==0.23.0\nTorchaudio==2.8.0')
  })
})
