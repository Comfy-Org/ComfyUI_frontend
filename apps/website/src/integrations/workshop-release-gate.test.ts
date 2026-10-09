// @vitest-environment node

import type { AstroIntegrationLogger, HookParameters } from 'astro'
import { mergeConfig, validateConfig } from 'astro/config'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { modelsBuildRoutes, workshopReleaseGate } from './workshop-release-gate'

import { workshopModels } from '@/config/workshop-browse-content'

const [{ slug: modelSlug }] = workshopModels

let root: string
const logger: AstroIntegrationLogger = {
  label: 'test',
  options: { level: 'silent', destination: { write: vi.fn() } },
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  flush: vi.fn(),
  close: vi.fn(),
  fork() {
    return this
  }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'workshop-release-test-'))
  await mkdir(join(root, 'workshop'), { recursive: true })
  await writeFile(join(root, 'workshop/index.html'), 'Workshop')
  await writeFile(join(root, 'index.html'), 'Home')
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

/**
 * Every plugin name in a Vite `plugins` option, however deeply nested. Walked by
 * hand on `unknown`: `flat(Infinity)` on Vite's recursive `PluginOption` type
 * exceeds TypeScript's instantiation depth.
 */
function pluginNames(option: unknown): unknown[] {
  if (Array.isArray(option)) return option.flatMap(pluginNames)
  return option !== null && typeof option === 'object' && 'name' in option
    ? [option.name]
    : []
}

const builtModelsRoutes = (patterns = modelsBuildRoutes(false)) =>
  new Map(
    patterns.map(({ pattern }) => [
      pattern,
      [pathToFileURL(`${root}${pattern}/index.html`)]
    ])
  )

async function buildDone(
  assets = builtModelsRoutes(),
  modelsPages: string[] = []
) {
  const hook = workshopReleaseGate().hooks['astro:build:done']
  if (!hook) throw new Error('Missing build hook')
  await hook({
    dir: pathToFileURL(`${root}/`),
    pages: [
      { pathname: '' },
      { pathname: 'workshop/' },
      ...modelsPages.map((pathname) => ({ pathname }))
    ],
    assets,
    logger
  })
}

describe('Workshop release output', () => {
  it('registers the catalogue client boundary during Astro setup', async () => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '0')
    const config = await validateConfig({}, root, 'build')
    // Applies each update with the same merge Astro's hook runner uses, so the
    // assertion is on the configuration Astro would actually build with, not
    // on the argument the integration happened to pass.
    let applied = config
    const updateConfig = vi.fn<
      HookParameters<'astro:config:setup'>['updateConfig']
    >((update) => {
      applied = mergeConfig(applied, update)
      return applied
    })
    const hook = workshopReleaseGate().hooks['astro:config:setup']
    if (!hook) throw new Error('Missing config setup hook')
    await hook({
      config,
      command: 'build',
      isRestart: false,
      updateConfig,
      injectRoute: vi.fn(),
      injectScript: vi.fn(),
      addRenderer: vi.fn(),
      addWatchFile: vi.fn(),
      addClientDirective: vi.fn(),
      addDevToolbarApp: vi.fn(),
      addMiddleware: vi.fn(),
      createCodegenDir: () => pathToFileURL(`${root}/.astro/`),
      logger
    })
    expect(updateConfig).toHaveBeenCalledOnce()
    expect(pluginNames(applied.vite.plugins)).toContain(
      'workshop-client-boundary'
    )
  })

  it('rejects an invalid Cloud family before building', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('WORKSHOP_IN_BUILD', '1')
    vi.stubEnv('PUBLIC_WORKSHOP_CLOUD_ENV', 'prod')

    const hook = workshopReleaseGate().hooks['astro:build:start']
    if (!hook) throw new Error('Missing build start hook')

    expect(() => hook({ logger, setPrerenderer: vi.fn() })).toThrow(
      /may only reach staging or test Cloud/
    )
  })

  it('builds every Models page either way and adds checkout only with Workshop', () => {
    const disabled = modelsBuildRoutes(false)
    expect(disabled.map((route) => route.pattern)).toEqual([
      '/hub',
      '/hub/models',
      '/hub/models/[slug]',
      '/hub/workflows',
      '/hub/apps',
      '/hub/workflows/[slug]',
      '/hub/workflows/manifest.json',
      '/models/showcase',
      '/hub/apps/[app]',
      '/cinematic-studio',
      '/models/[...slug]/page.json',
      '/models/catalogue.json'
    ])
    const enabled = modelsBuildRoutes(true)
    expect(enabled.map((route) => route.pattern)).toEqual([
      ...disabled.map((route) => route.pattern),
      '/checkout-opening',
      '/zh-CN/checkout-opening',
      '/checkout-return',
      '/zh-CN/checkout-return'
    ])
    for (const routes of [disabled, enabled]) {
      expect(
        routes.find(({ pattern }) => pattern === '/hub/models')?.entrypoint
      ).toContain('/routes/models/index.astro')
      for (const route of routes)
        expect(existsSync(route.entrypoint)).toBe(true)
    }
  })

  it('fails a build without Workshop that drops a Models page or ships a Workshop-only page', async () => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '0')
    await expect(buildDone()).resolves.toBeUndefined()
    const withoutModelPages = builtModelsRoutes()
    withoutModelPages.delete('/hub/workflows/[slug]')
    await expect(buildDone(withoutModelPages)).rejects.toThrow(
      'Missing: /hub/workflows/[slug]. Workshop-only: none.'
    )
    await expect(
      buildDone(builtModelsRoutes(modelsBuildRoutes(true)))
    ).rejects.toThrow(
      'Missing: none. Workshop-only: /checkout-opening, /zh-CN/checkout-opening, /checkout-return, /zh-CN/checkout-return.'
    )
  })

  it('removes only Workshop output when disabled, including repeated builds', async () => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '0')
    await buildDone()
    expect(existsSync(join(root, 'workshop'))).toBe(false)
    expect(await readFile(join(root, 'index.html'), 'utf8')).toBe('Home')
    await expect(buildDone()).resolves.toBeUndefined()
  })

  it.for(['0', '1'])(
    'rejects a built Models page the URL registry does not know (WORKSHOP_IN_BUILD=%s)',
    async (value) => {
      vi.stubEnv('WORKSHOP_IN_BUILD', value)
      await expect(
        buildDone(builtModelsRoutes(), [
          'models/',
          `models/${modelSlug}/`,
          'hub/models/local/',
          'hub/models/local/4x-ultrasharp/',
          'hub/models/local/4x-ultrasharp.md',
          'hub/models/local/llms.txt'
        ])
      ).resolves.toBeUndefined()
      await expect(
        buildDone(builtModelsRoutes(), ['models/unregistered/'])
      ).rejects.toThrow(
        'missing from models-url-registry.ts (/models/unregistered)'
      )
    }
  )

  it.for([
    {
      file: 'models/bfl--flux-2-max--generate-images/page.json',
      content:
        '{"related":[{"href":"/models/bfl--flux-2-pro--generate-images/"}]}'
    },
    {
      file: 'models/catalogue.json',
      content: '[{"href":"/models/bfl--flux-2-pro--generate-images/"}]'
    },
    {
      file: 'index.md',
      content:
        '[Flux 2 Pro](https://comfy.org/models/bfl--flux-2-pro--generate-images/)'
    }
  ])('rejects an old model link in $file', async ({ file, content }) => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '1')
    await mkdir(dirname(join(root, file)), { recursive: true })
    await writeFile(
      join(root, file),
      content.replace('/models/bfl--flux-2-pro', '/hub/models/flux-2-pro')
    )
    await expect(buildDone()).resolves.toBeUndefined()
    await writeFile(join(root, file), content)
    await expect(buildDone()).rejects.toThrow(
      `/${file} → /models/bfl--flux-2-pro--generate-images`
    )
  })

  it('retires legacy Workshop output even when Models is enabled', async () => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '1')
    await mkdir(join(root, 'models/example'), { recursive: true })
    await writeFile(
      join(root, 'models/example/index.html'),
      'Models playground'
    )
    await buildDone()
    expect(existsSync(join(root, 'workshop'))).toBe(false)
    expect(
      await readFile(join(root, 'models/example/index.html'), 'utf8')
    ).toBe('Models playground')
    expect(await readFile(join(root, 'index.html'), 'utf8')).toBe('Home')
  })
})
