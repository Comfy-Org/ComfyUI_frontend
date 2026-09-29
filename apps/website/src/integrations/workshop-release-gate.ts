import type { AstroIntegration } from 'astro'
import { envField } from 'astro/config'
// Both imported statically. A dynamic `import()` inside the hook throws
// "Vite module runner has been closed" — by `astro:build:done` the runner that
// resolves module specifiers is gone, so anything not already loaded fails.
import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { workshopClientBoundary } from './workshop-client-boundary'

import {
  HUB_MODELS_PATH,
  HUB_WORKFLOWS_PATH,
  oldModelLinks
} from '../config/hub-models'
import { unregisteredModelsPaths } from '../config/models-url-registry'

import {
  assertWorkshopCloudEnvForBuild,
  isWorkshopInBuild,
  isLegacyWorkshopRoute
} from '../config/workshop-release'

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
    {
      pattern: `${HUB_WORKFLOWS_PATH}/[slug]`,
      entrypoint: entry('[slug].astro')
    },
    { pattern: '/models/showcase', entrypoint: entry('showcase.astro') },
    { pattern: '/models/apps/[app]', entrypoint: entry('app.astro') },
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

async function pagesLinkingOldModels(
  root: string,
  pages: readonly { pathname: string }[]
) {
  const found = await Promise.all(
    pages.map(async ({ pathname }) => {
      const file = join(root, pathname, 'index.html')
      if (!existsSync(file)) return []
      return oldModelLinks(await readFile(file, 'utf8')).map(
        (link) => `/${pathname} → ${link}`
      )
    })
  )
  return found.flat()
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
      'astro:build:done': async ({ dir, pages, logger }) => {
        const unregistered = unregisteredModelsPaths(
          pages.map((page) => page.pathname)
        )
        if (unregistered.length > 0) {
          throw new Error(
            `workshop-release-gate found Models pages missing from models-url-registry.ts (${unregistered.join(', ')}); register each address with its kind.`
          )
        }

        const root = fileURLToPath(dir)
        const stale = await pagesLinkingOldModels(root, pages)
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

        const leaked = WORKSHOP_ONLY_ROUTES.map(
          (route) => route.pattern
        ).filter((pattern) => existsSync(join(root, pattern)))
        if (leaked.length > 0) {
          throw new Error(
            `workshop-release-gate found Workshop-only pages (${leaked.join(', ')}) in a build without Workshop; refusing to ship them.`
          )
        }
        logger.info(
          'Workshop is off: every page builds, and Run and the Models nav stay hidden.'
        )
      }
    }
  }
}
