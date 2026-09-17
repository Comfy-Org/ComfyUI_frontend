import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PACKAGE_JSON = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'package.json'
)

/** Published from this repo alongside the core, so npm can resolve them. */
const PUBLISHED_ALONGSIDE = ['@comfyorg/ingest-types']

describe('publish boundary', () => {
  it('reaches no workspace package a consumer cannot install from npm', () => {
    const {
      dependencies = {},
      peerDependencies = {}
    }: {
      dependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    } = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'))

    const unreachable = Object.entries({ ...dependencies, ...peerDependencies })
      .filter(([, range]) => range.startsWith('workspace:'))
      .map(([name]) => name)
      .filter((name) => !PUBLISHED_ALONGSIDE.includes(name))

    expect(unreachable).toEqual([])
  })
})
