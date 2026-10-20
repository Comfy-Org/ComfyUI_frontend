import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'
import { createServer } from 'vite'

import manifest from '@website/.storybook/generated/component-manifest.json'
import { websiteRoot } from '@website/paths'

import { discoverCatalogStories } from '@website/.storybook/story-discovery'

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
    for (const component of manifest.components) {
      const resolved = await server.pluginContainer.resolveId(
        component.agent.importPath
      )
      expect(resolved?.id).toBe(join(websiteRoot, component.source))
      expect(storyFiles[`/${component.storyFile}`]).toBeDefined()
    }
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
