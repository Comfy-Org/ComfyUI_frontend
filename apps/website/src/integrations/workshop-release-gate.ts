import type { AstroIntegration } from 'astro'
import { envField } from 'astro/config'
// Both imported statically. A dynamic `import()` inside the hook throws
// "Vite module runner has been closed" — by `astro:build:done` the runner that
// resolves module specifiers is gone, so anything not already loaded fails.
import { existsSync } from 'node:fs'
import { readdir, readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { basename, join, relative } from 'node:path'

import { workshopClientBoundary } from './workshop-client-boundary'

import {
  HUB_APPS_PATH,
  HUB_MODELS_PATH,
  HUB_WORKFLOWS_PATH,
  oldModelLinks
} from '@/config/hub-models'
import { unregisteredModelsPaths } from '@/config/models-url-registry'
import { markdownTwinPath } from '@/lib/markdown-twin-path'

import {
  assertWorkshopCloudEnvForBuild,
  isWorkshopInBuild,
  isLegacyWorkshopRoute
} from '@/config/workshop-release'

const entry = (name: string) =>
  fileURLToPath(new URL(`../routes/models/${name}`, import.meta.url))

const WORKSHOP_ONLY_ROUTES = [
  { pattern: '/checkout-opening', entrypoint: entry('checkout-opening.astro') },
  {
    pattern: '/zh-CN/checkout-opening',
    entrypoint: entry('checkout-opening.astro')
  },
  { pattern: '/checkout-return', entrypoint: entry('checkout-return.astro') },
  {
    pattern: '/zh-CN/checkout-return',
    entrypoint: entry('checkout-return.astro')
  }
]

export function modelsBuildRoutes(enabled: boolean) {
  return [
    { pattern: HUB_MODELS_PATH, entrypoint: entry('index.astro') },
    { pattern: `${HUB_MODELS_PATH}/[slug]`, entrypoint: entry('[slug].astro') },
    { pattern: HUB_WORKFLOWS_PATH, entrypoint: entry('hub-section.astro') },
    { pattern: HUB_APPS_PATH, entrypoint: entry('hub-section.astro') },
    {
      pattern: `${HUB_WORKFLOWS_PATH}/[slug]`,
      entrypoint: entry('[slug].astro')
    },
    {
      pattern: `${HUB_WORKFLOWS_PATH}/manifest.json`,
      entrypoint: entry('hub-workflows-manifest.json.ts')
    },
    { pattern: '/models/showcase', entrypoint: entry('showcase.astro') },
    { pattern: `${HUB_APPS_PATH}/[app]`, entrypoint: entry('app.astro') },
    {
      pattern: '/cinematic-studio',
      entrypoint: entry('cinematic-studio.astro')
    },
    {
      pattern: '/models/[...slug]/page.json',
      entrypoint: entry('page.json.ts')
    },
    {
      pattern: '/models/catalogue.json',
      entrypoint: entry('catalogue.json.ts')
    },
    ...(enabled ? WORKSHOP_ONLY_ROUTES : [])
  ]
}

async function modelsDataFiles(root: string) {
  const modelsDir = join(root, 'models')
  if (!existsSync(modelsDir)) return []
  const entries = await readdir(modelsDir, { recursive: true })
  return entries
    .filter(
      (entry) => entry === 'catalogue.json' || basename(entry) === 'page.json'
    )
    .map((entry) => join(modelsDir, entry))
}

async function filesLinkingOldModels(
  root: string,
  pages: readonly { pathname: string }[]
) {
  const pageFiles = pages.flatMap(({ pathname }) => {
    if (isLegacyWorkshopRoute(`/${pathname}`)) return []
    const trimmed = pathname.replace(/\/$/, '')
    const html = [
      join(root, pathname, 'index.html'),
      join(root, `${trimmed}.html`)
    ].find((candidate) => existsSync(candidate))
    // Twins exist only because markdownTwins() runs before this in astro.config.ts.
    return [html, join(root, markdownTwinPath(`/${pathname}`))]
  })
  const found: string[] = []
  for (const file of [...pageFiles, ...(await modelsDataFiles(root))]) {
    if (!file || !existsSync(file)) continue
    for (const link of oldModelLinks(await readFile(file, 'utf8')))
      found.push(`/${relative(root, file)} → ${link}`)
  }
  return found
}

export function workshopReleaseGate(): AstroIntegration {
  return {
    name: 'workshop-release-gate',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig, command }) => {
        updateConfig({
          env: {
            schema: {
              WORKSHOP_LOCAL_DEV: envField.boolean({
                context: 'client',
                access: 'public',
                default: command === 'dev' && !process.env.VERCEL_ENV
              }),
              WORKSHOP_DEPLOY_ENV: envField.string({
                context: 'client',
                access: 'public',
                default: process.env.VERCEL_ENV ?? ''
              }),
              WORKSHOP_RELEASE: envField.string({
                context: 'client',
                access: 'public',
                default: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local'
              }),
              WORKSHOP_INCLUDED: envField.boolean({
                context: 'client',
                access: 'public',
                default: isWorkshopInBuild()
              })
            }
          },
          vite: {
            plugins: [workshopClientBoundary()]
          }
        })
        for (const route of modelsBuildRoutes(isWorkshopInBuild()))
          injectRoute(route)
      },
      'astro:build:start': () => {
        assertWorkshopCloudEnvForBuild()
      },
      'astro:build:done': async ({ dir, pages, assets, logger }) => {
        // The sitemap and .md twins read these same pages; extend if either walks dist/
        const unregistered = unregisteredModelsPaths(
          pages.map((page) => page.pathname)
        )
        if (unregistered.length > 0) {
          throw new Error(
            `workshop-release-gate found Models pages missing from models-url-registry.ts (${unregistered.join(', ')}); register each address with its kind.`
          )
        }

        const root = fileURLToPath(dir)
        const stale = await filesLinkingOldModels(root, pages)
        if (stale.length > 0) {
          throw new Error(
            `workshop-release-gate found links to old /models addresses, which now redirect (${stale.join(', ')}); link the /hub/models page instead.`
          )
        }

        const built = pages.filter((page) =>
          isLegacyWorkshopRoute(`/${page.pathname}`)
        ).length

        const workshopOutput = join(root, 'workshop')
        await rm(workshopOutput, { recursive: true, force: true })
        if (existsSync(workshopOutput)) {
          throw new Error(
            'workshop-release-gate could not remove the retired Workshop output; refusing to ship it.'
          )
        }
        logger.info(`Removed ${built} retired Workshop pages.`)
        if (isWorkshopInBuild()) return

        const unbuilt = modelsBuildRoutes(false)
          .map(({ pattern }) => pattern)
          .filter((pattern) => !assets.get(pattern)?.length)
        const leaked = WORKSHOP_ONLY_ROUTES.map(
          ({ pattern }) => pattern
        ).filter((pattern) => assets.has(pattern))
        if (unbuilt.length > 0 || leaked.length > 0) {
          throw new Error(
            `workshop-release-gate: a build without Workshop must keep every Models page and no Workshop-only page. Missing: ${unbuilt.join(', ') || 'none'}. Workshop-only: ${leaked.join(', ') || 'none'}.`
          )
        }
        logger.info(
          'Workshop is off: every page builds, and Run and the Models nav stay hidden.'
        )
      }
    }
  }
}
