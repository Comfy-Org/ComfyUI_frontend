import type { AstroIntegration } from 'astro'
// Both imported statically. A dynamic `import()` inside the hook throws
// "Vite module runner has been closed" — by `astro:build:done` the runner that
// resolves module specifiers is gone, so anything not already loaded fails.
import { existsSync } from 'node:fs'
import { readdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { isWorkshopInBuild, isWorkshopRoute } from '../config/workshop-release'

export function modelsBuildRoutes(enabled: boolean) {
  const entry = (name: string) =>
    fileURLToPath(new URL(`../routes/models/${name}.astro`, import.meta.url))
  return [
    { pattern: '/models', entrypoint: entry(enabled ? 'index' : 'showcase') },
    ...(enabled
      ? [
          { pattern: '/models/[slug]', entrypoint: entry('[slug]') },
          { pattern: '/models/showcase', entrypoint: entry('showcase') }
        ]
      : [])
  ]
}

/**
 * Keeps Workshop out of a release build.
 *
 * Workshop is unfinished, and `noindex` does not stop a page being deployed —
 * it only asks a crawler to stay away, while the page stays live at a URL
 * anyone can share. A deployed build must not contain those routes at all.
 *
 * Models routes are registered only when enabled, with the existing marketing
 * page retained at /models otherwise. The legacy Workshop tree still uses
 * `astro:build:done` to remove its emitted directory. The
 * earlier attempt filtered the route list at `astro:routes:resolved`, which
 * does not work: that hook reports the resolved routes, and mutating the
 * array does not stop them being generated. Deleting the output is
 * unambiguous. These checks cover route output, not shared CSS or translations.
 *
 * Preview builds are release builds too — a preview answers "what goes out if
 * we release right now?", so it excludes Workshop for the same reason. Local
 * development keeps it, and so does any build asked for it explicitly. See
 * `config/workshop-release.ts` for the switch.
 */
export function workshopReleaseGate(): AstroIntegration {
  return {
    name: 'workshop-release-gate',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        for (const route of modelsBuildRoutes(isWorkshopInBuild()))
          injectRoute(route)
      },
      'astro:build:done': async ({ dir, pages, logger }) => {
        if (isWorkshopInBuild()) return

        const built = pages.filter((page) =>
          isWorkshopRoute(`/${page.pathname}`)
        ).length

        const root = fileURLToPath(dir)
        const workshopOutput = join(root, 'workshop')
        await rm(workshopOutput, { recursive: true, force: true })

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
        if (existsSync(workshopOutput)) {
          throw new Error(
            'workshop-release-gate could not remove the Workshop output; refusing to ship it.'
          )
        }

        logger.warn(
          `Workshop is excluded from this build: removed ${built} generated page${
            built === 1 ? '' : 's'
          }. Set WORKSHOP_IN_BUILD=1 to include it.`
        )
      }
    }
  }
}
