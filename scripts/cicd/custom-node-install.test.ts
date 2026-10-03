import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import * as customNodeInstaller from './custom-node-install'
import {
  parseDeployRef,
  parseShardRows,
  registryArtifactUrl,
  torchConstraints
} from './custom-node-install'

const tempDirectories: string[] = []

afterEach(() => {
  for (const directory of tempDirectories)
    rmSync(directory, { recursive: true, force: true })
  tempDirectories.length = 0
})

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

  it('rebuilds the reusable cache from untouched source staging', () => {
    const root = mkdtempSync(join(tmpdir(), 'custom-node-cache-test-'))
    tempDirectories.push(root)
    const staging = join(root, 'staging')
    const cache = join(root, 'cache', 'pack')
    mkdirSync(staging, { recursive: true })
    mkdirSync(cache, { recursive: true })
    writeFileSync(join(staging, 'node.py'), 'pinned source')
    writeFileSync(join(cache, 'node.py'), 'mutated during requirements install')
    writeFileSync(`${cache}.ref`, 'wrong-ref')

    const refreshSourceCache = Reflect.get(
      customNodeInstaller,
      'refreshSourceCache'
    )
    expect(refreshSourceCache).toBeTypeOf('function')
    if (typeof refreshSourceCache !== 'function') return
    refreshSourceCache(staging, cache, 'pack@1.2.3')

    expect(readFileSync(join(cache, 'node.py'), 'utf8')).toBe('pinned source')
    expect(readFileSync(`${cache}.ref`, 'utf8')).toBe('pack@1.2.3')
  })
})
