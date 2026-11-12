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

const INSTANCE_SHARED_WITH_CONSUMER = ['zod']

interface Specifiers {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const readSpecifiers = (): Required<Specifiers> => {
  const { dependencies = {}, peerDependencies = {} }: Specifiers = JSON.parse(
    readFileSync(PACKAGE_JSON, 'utf8')
  )
  return { dependencies, peerDependencies }
}

describe('publish boundary', () => {
  it('reaches no workspace package a consumer cannot install from npm', () => {
    const { dependencies, peerDependencies } = readSpecifiers()

    const unreachable = Object.entries({ ...dependencies, ...peerDependencies })
      .filter(([, range]) => range.startsWith('workspace:'))
      .map(([name]) => name)
      .filter((name) => !PUBLISHED_ALONGSIDE.includes(name))

    expect(unreachable).toEqual([])
  })

  it('takes the consumer copy of every library whose values it hands out', () => {
    const { dependencies, peerDependencies } = readSpecifiers()

    const privatelyOwned = INSTANCE_SHARED_WITH_CONSUMER.filter(
      (name) => name in dependencies || !(name in peerDependencies)
    )

    expect(privatelyOwned).toEqual([])
  })
})
