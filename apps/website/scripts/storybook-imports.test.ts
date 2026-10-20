import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'
import { createServer } from 'vite'

import manifest from '@website/.storybook/generated/component-manifest.json'
import coverage from '@website/.storybook/generated/story-coverage.json'
import { websiteRoot } from '@website/paths'

import {
  discoverCatalogStories,
  storyPatterns
} from '@website/.storybook/story-discovery'

import { portablePath } from './storybook-metadata'

const storyFiles = import.meta.glob('/src/**/*.stories.ts')

describe('published component imports', () => {
  it('resolves every advertised import through Vite', async () => {
    const server = await createServer({
      configFile: false,
      root: websiteRoot,
      resolve: { alias: { '@': join(websiteRoot, 'src') } },
      server: { middlewareMode: true }
    })
    onTestFinished(() => server.close())
    expect(manifest.components.length).toBeGreaterThan(0)
    for (const component of manifest.components) {
      const resolved = await server.pluginContainer.resolveId(
        component.agent.importPath
      )
      expect(portablePath(resolved?.id ?? '')).toBe(
        portablePath(join(websiteRoot, component.source))
      )
      expect((await stat(join(websiteRoot, component.source))).isFile()).toBe(
        true
      )
      expect(storyFiles[`/${component.storyFile}`]).toBeDefined()
    }
  })

  it('accounts for every discovered story and showcase', async () => {
    const discovered = (await discoverCatalogStories(websiteRoot))
      .map((file) => portablePath(relative(websiteRoot, file)))
      .sort()
    const recorded = [
      ...new Set([
        ...manifest.components.map(({ storyFile }) => storyFile),
        ...manifest.showcases.map(({ storyFile }) => storyFile)
      ])
    ].sort()
    expect(recorded).toEqual(discovered)
    for (const showcase of manifest.showcases) {
      for (const source of showcase.sources) {
        expect((await stat(join(websiteRoot, source))).isFile()).toBe(true)
        expect(coverage.missingStories).not.toContain(source)
      }
    }
  })

  it.for(['src/**/*.stories.tsx', 'src/**/*.mdx', 'stories/**/*.ts'])(
    'rejects unsupported discovery pattern %s',
    (pattern) => {
      expect(() => storyPatterns(['src/**/*.stories.ts', pattern])).toThrow(
        'Unsupported catalog story patterns'
      )
    }
  )

  it('rejects empty catalog discovery', () => {
    expect(() => storyPatterns(['src/env.d.ts'])).toThrow(
      'Missing catalog story patterns'
    )
  })

  it('discovers a story in a new component directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'storybook-discovery-'))
    onTestFinished(() => rm(root, { recursive: true, force: true }))
    const directory = join(root, 'src/components/pricing')
    await mkdir(directory, { recursive: true })
    const story = join(directory, 'PricingSection.stories.ts')
    await writeFile(story, '')
    expect(await discoverCatalogStories(root)).toEqual([story])
  })
})
