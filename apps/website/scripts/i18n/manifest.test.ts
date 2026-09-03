import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { hashSource, loadManifest, saveManifest } from './manifest'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'i18n-manifest-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('loadManifest', () => {
  it('returns an empty manifest when the file does not exist', () => {
    expect(loadManifest(join(dir, 'missing.json'))).toEqual({
      version: 1,
      entries: {}
    })
  })

  it('rejects a file with the wrong shape', () => {
    const path = join(dir, 'manifest.json')
    writeFileSync(path, JSON.stringify({ version: 2 }))
    expect(() => loadManifest(path)).toThrow()
  })
})

describe('saveManifest + loadManifest', () => {
  it('round-trips entries and sorts keys', () => {
    const path = join(dir, 'manifest.json')
    saveManifest(path, {
      version: 1,
      entries: {
        'ui.readMore': { ja: hashSource('Read more') },
        'ui.copy': { ja: hashSource('Copy'), 'zh-CN': hashSource('Copy') }
      }
    })
    expect(loadManifest(path)).toEqual({
      version: 1,
      entries: {
        'ui.copy': { ja: hashSource('Copy'), 'zh-CN': hashSource('Copy') },
        'ui.readMore': { ja: hashSource('Read more') }
      }
    })
  })
})

describe('hashSource', () => {
  it('is deterministic and sensitive to content changes', () => {
    expect(hashSource('Copy')).toBe(hashSource('Copy'))
    expect(hashSource('Copy')).not.toBe(hashSource('copy'))
  })
})
