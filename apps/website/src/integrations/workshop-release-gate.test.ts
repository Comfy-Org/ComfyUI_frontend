import type { AstroIntegrationLogger, HookParameters } from 'astro'
import { mergeConfig, validateConfig } from 'astro/config'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { modelsBuildRoutes, workshopReleaseGate } from './workshop-release-gate'

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

async function buildDone() {
  const hook = workshopReleaseGate().hooks['astro:build:done']
  if (!hook) throw new Error('Missing build hook')
  await hook({
    dir: pathToFileURL(`${root}/`),
    pages: [{ pathname: '' }, { pathname: 'workshop/' }],
    assets: new Map(),
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

  it('registers the original marketing entry when disabled and only approved Models routes when enabled', () => {
    expect(modelsBuildRoutes(false)).toEqual([
      {
        pattern: '/models',
        entrypoint: expect.stringContaining('/routes/models/showcase.astro')
      }
    ])
    const enabled = modelsBuildRoutes(true)
    expect(enabled.map((route) => route.pattern)).toEqual([
      '/models',
      '/models/[slug]',
      '/models/showcase'
    ])
    expect(enabled[0].entrypoint).toContain('/routes/models/index.astro')
    for (const route of enabled) expect(existsSync(route.entrypoint)).toBe(true)
  })

  it('preserves the established Models page and rejects ungated detail routes', async () => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '0')
    await mkdir(join(root, 'models'), { recursive: true })
    await writeFile(join(root, 'models/index.html'), 'Models marketing')
    await buildDone()
    expect(await readFile(join(root, 'models/index.html'), 'utf8')).toBe(
      'Models marketing'
    )
    await mkdir(join(root, 'models/leaked-detail'))
    await writeFile(join(root, 'models/leaked-detail/index.html'), 'Run')
    await expect(buildDone()).rejects.toThrow('ungated Models route')
  })

  it('removes only Workshop output when disabled, including repeated builds', async () => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '0')
    await buildDone()
    expect(existsSync(join(root, 'workshop'))).toBe(false)
    expect(await readFile(join(root, 'index.html'), 'utf8')).toBe('Home')
    await expect(buildDone()).resolves.toBeUndefined()
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
