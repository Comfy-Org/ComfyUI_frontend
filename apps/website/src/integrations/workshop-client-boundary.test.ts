import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { workshopClientBoundary } from './workshop-client-boundary'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'workshop-client-boundary-'))
  await mkdir(join(root, 'src/config'), { recursive: true })
  await mkdir(join(root, 'src/content'), { recursive: true })
  await mkdir(join(root, 'src/data'), { recursive: true })
  await writeFile(
    join(root, 'src/config/models-catalogue.ts'),
    'export const models = [{ name: "Unreleased model" }]'
  )
  await writeFile(
    join(root, 'src/content/workshop-models.json'),
    '[{"name":"Unreleased model"}]'
  )
  vi.stubEnv('WORKSHOP_IN_BUILD', '0')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function compile(entry: string, ssr = false) {
  await writeFile(join(root, 'entry.ts'), entry)
  return build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [workshopClientBoundary()],
    build: {
      ssr,
      write: false,
      minify: false,
      rolldownOptions: {
        input: join(root, 'entry.ts'),
        output: { entryFileNames: 'unrelated-[hash].js' }
      }
    }
  })
}

describe('disabled Workshop client boundary', () => {
  it.for([
    'import { models } from "./src/config/models-catalogue"; console.log(models)',
    'import("./src/config/models-catalogue").then(({models}) => console.log(models))',
    'import models from "./src/content/workshop-models.json"; console.log(models)'
  ])('rejects catalogue data in emitted client chunks: %s', async (entry) => {
    await expect(compile(entry)).rejects.toThrow(
      /Workshop is disabled, but .*\.js contains .*\/src\/(config|content)\//
    )
  })

  it('allows the server to resolve catalogue data', async () => {
    await expect(
      compile('export { models } from "./src/config/models-catalogue"', true)
    ).resolves.toBeDefined()
  })

  it.for([
    'data/workshop-router-display-names.json',
    'data/workshop-thumbnail-labels.json',
    'data/workshop-node-pricing.json',
    'data/workshop-content-inputs.json',
    'data/workshop-router-openapi.snapshot.json',
    'data/workshop-router-identity-audit.json',
    'content/workshop-router-aliases.json',
    'data/workshop-future-generated.json',
    'content/workshop-future-generated.json'
  ])('rejects sibling catalogue data imported directly: %s', async (path) => {
    await writeFile(join(root, 'src', path), '[{"name":"Unreleased model"}]')
    await expect(
      compile(`import data from "./src/${path}"; console.log(data)`)
    ).rejects.toThrow(/Workshop is disabled, but .* contains .*\/workshop-/)
  })

  it('rejects sibling catalogue data in a lazy chunk', async () => {
    await writeFile(
      join(root, 'src/data/workshop-thumbnail-labels.json'),
      '{"unreleased-model":"Turbo"}'
    )
    await expect(
      compile(
        'import("./src/data/workshop-thumbnail-labels.json").then(({default: labels}) => console.log(labels))'
      )
    ).rejects.toThrow(/Workshop is disabled, but .* contains .*\/workshop-/)
  })

  it('allows ordinary site JSON outside the catalogue boundary', async () => {
    await writeFile(join(root, 'src/data/site-copy.json'), '{"title":"Models"}')
    await expect(
      compile('import copy from "./src/data/site-copy.json"; console.log(copy)')
    ).resolves.toBeDefined()
  })

  it('allows catalogue code in an explicitly enabled client build', async () => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '1')
    await expect(
      compile(
        'import { models } from "./src/config/models-catalogue"; console.log(models)'
      )
    ).resolves.toBeDefined()
  })

  it('does not reject ordinary marketing copy or erased type-only imports', async () => {
    await writeFile(
      join(root, 'src/config/models-catalogue.ts'),
      'export interface Model { name: string }; export const models = [{ name: "Unreleased model" }]'
    )
    await expect(
      compile(
        'import type { Model } from "./src/config/models-catalogue"; const title: Model = {name: "Models catalogue"}; console.log(title)'
      )
    ).resolves.toBeDefined()
  })
})
