import { describe, expect, it } from 'vitest'

import type { NodePack } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import {
  UNLISTED_LICENSE,
  licenseOptions,
  matchesQuery,
  normalizeLicense
} from '@/platform/workspace/buildCustomNodes/nodePackTable'

function pack(name: string, license: string): NodePack {
  return {
    id: name.toLowerCase(),
    name,
    publisher: 'Kijai',
    installs: 1,
    stars: 1,
    license
  }
}

describe('normalizeLicense', () => {
  it.for([
    ['MIT License', 'MIT'],
    ['mit', 'MIT'],
    ['Apache License 2.0', 'Apache-2.0'],
    ['GPL-3.0-or-later', 'GPL-3.0'],
    ['GNU General Public License v3.0', 'GPL-3.0'],
    ['LICENSE.txt', UNLISTED_LICENSE],
    ['', UNLISTED_LICENSE],
    ['Custom terms', 'Custom terms']
  ] as const)('%s files under %s', ([raw, expected]) => {
    expect(normalizeLicense(raw)).toBe(expected)
  })
})

describe('licenseOptions', () => {
  it('offers each license once, A to Z, with the unlisted bucket last', () => {
    expect(
      licenseOptions([
        pack('A', 'MIT License'),
        pack('B', ''),
        pack('C', 'Apache-2.0'),
        pack('D', 'mit')
      ])
    ).toEqual(['Apache-2.0', 'MIT', UNLISTED_LICENSE])
  })
})

describe('matchesQuery', () => {
  it('ignores case and separators, and matches the publisher too', () => {
    expect(matchesQuery(pack('ComfyUI-KJNodes', ''), 'kj nodes')).toBe(true)
    expect(matchesQuery(pack('ComfyUI-KJNodes', ''), 'kijai')).toBe(true)
    expect(matchesQuery(pack('ComfyUI-KJNodes', ''), 'impact')).toBe(false)
  })
})
