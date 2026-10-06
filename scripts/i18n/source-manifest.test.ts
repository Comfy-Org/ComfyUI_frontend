import { describe, expect, it } from 'vitest'

import type { SourceManifest } from './source-manifest'
import { loadManifest } from './source-manifest'

const filename = '/catalogs/.source-manifest.json'
const sha1 = 'a'.repeat(40)
const sha256 = 'b'.repeat(64)

describe('loadManifest', () => {
  it.for<{ label: string; manifest: SourceManifest }>([
    {
      label: 'blob IDs without known violations',
      manifest: { version: 1, files: { 'main.json': sha1 } }
    },
    {
      label: 'SHA-1 and SHA-256 blob IDs with known violation paths',
      manifest: {
        version: 1,
        files: { 'main.json': sha1, 'nodeDefs.json': sha256 },
        knownViolations: { 'main.json': ['["hero","title"]'] }
      }
    }
  ])('parses $label', ({ manifest }) => {
    expect(loadManifest(filename, JSON.stringify(manifest))).toEqual(manifest)
  })

  it.for([
    { label: 'corrupt JSON', content: '{"version":', detail: 'JSON' },
    {
      label: 'a version 3 manifest',
      content: JSON.stringify({ version: 3, files: {} }),
      detail: '["version"]'
    },
    {
      label: 'a truncated blob ID',
      content: JSON.stringify({ version: 1, files: { 'main.json': 'abc' } }),
      detail: '["files","main.json"]'
    },
    {
      label: 'an uppercase blob ID',
      content: JSON.stringify({
        version: 1,
        files: { 'main.json': 'A'.repeat(40) }
      }),
      detail: '["files","main.json"]'
    },
    {
      label: 'per-file fingerprint objects',
      content: JSON.stringify({
        version: 1,
        files: { 'main.json': { source: {}, locales: {} } }
      }),
      detail: '["files","main.json"]'
    },
    {
      label: 'known violations that are not path lists',
      content: JSON.stringify({
        version: 1,
        files: { 'main.json': sha1 },
        knownViolations: { 'main.json': '["title"]' }
      }),
      detail: '["knownViolations","main.json"]'
    },
    {
      label: 'an unknown top-level field',
      content: JSON.stringify({
        version: 1,
        files: { 'main.json': sha1 },
        reviewNeeded: {}
      }),
      detail: 'reviewNeeded'
    }
  ])(
    'fails closed on $label, naming the file and field',
    ({ content, detail }) => {
      expect(() => loadManifest(filename, content)).toThrow(
        `Cannot load source manifest ${filename}`
      )
      expect(() => loadManifest(filename, content)).toThrow(detail)
    }
  )
})
