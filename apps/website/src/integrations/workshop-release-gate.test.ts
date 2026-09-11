import type { AstroIntegrationLogger } from 'astro'
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

  it('preserves all output when enabled', async () => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '1')
    await buildDone()
    expect(await readFile(join(root, 'workshop/index.html'), 'utf8')).toBe(
      'Workshop'
    )
    expect(await readFile(join(root, 'index.html'), 'utf8')).toBe('Home')
  })
})
