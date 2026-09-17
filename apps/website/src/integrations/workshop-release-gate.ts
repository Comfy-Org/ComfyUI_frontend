import type { AstroIntegration } from 'astro'
import { envField } from 'astro/config'
// Both imported statically. A dynamic `import()` inside the hook throws
// "Vite module runner has been closed" — by `astro:build:done` the runner that
// resolves module specifiers is gone, so anything not already loaded fails.
import { existsSync } from 'node:fs'
import { readdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { workshopClientBoundary } from './workshop-client-boundary'

import {
  assertWorkshopCloudEnvForBuild,
  isWorkshopInBuild,
  isLegacyWorkshopRoute
} from '../config/workshop-release'

export function modelsBuildRoutes(enabled: boolean) {
  const entry = (name: string) =>
    fileURLToPath(new URL(`../routes/models/${name}`, import.meta.url))
  return [
    {
      pattern: '/models',
      entrypoint: entry(enabled ? 'index.astro' : 'showcase.astro')
    },
    ...(enabled
      ? [
          { pattern: '/models/[slug]', entrypoint: entry('[slug].astro') },
          { pattern: '/models/showcase', entrypoint: entry('showcase.astro') },
          {
            pattern: '/checkout-opening',
            entrypoint: entry('checkout-opening.astro')
          },
          {
            pattern: '/zh-CN/checkout-opening',
            entrypoint: entry('checkout-opening.astro')
          },
          {
            pattern: '/checkout-return',
            entrypoint: entry('checkout-return.astro')
          },
          {
            pattern: '/zh-CN/checkout-return',
            entrypoint: entry('checkout-return.astro')
          },
          {
            pattern: '/models/[slug]/page.json',
            entrypoint: entry('page.json.ts')
          },
          {
            pattern: '/models/catalogue.json',
            entrypoint: entry('catalogue.json.ts')
          }
        ]
      : [])
  ]
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
        const built = pages.filter((page) =>
          isLegacyWorkshopRoute(`/${page.pathname}`)
        ).length

        const root = fileURLToPath(dir)
        const workshopOutput = join(root, 'workshop')
        await rm(workshopOutput, { recursive: true, force: true })
        if (existsSync(workshopOutput)) {
          throw new Error(
            'workshop-release-gate could not remove the retired Workshop output; refusing to ship it.'
          )
        }
        logger.info(`Removed ${built} retired Workshop pages.`)
        if (isWorkshopInBuild()) return

        // Keep the established /models/index.html and its markdown twin, but
        // reject a newly added Models page that bypasses route registration.
        const modelEntries = existsSync(join(root, 'models'))
          ? await readdir(join(root, 'models'))
          : []
        if (modelEntries.some((name) => name !== 'index.html')) {
          throw new Error(
            'workshop-release-gate found an ungated Models route; refusing to ship it.'
          )
        }
        logger.warn(
          'Models detail routes are excluded from this build. Set WORKSHOP_IN_BUILD=1 to include them.'
        )
      }
    }
  }
}
