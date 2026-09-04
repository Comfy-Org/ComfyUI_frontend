import type { AstroIntegration } from 'astro'
import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { isWorkshopInBuild } from '../config/workshop-release'

/**
 * Keeps Workshop out of a release build.
 *
 * Workshop is unfinished, and `noindex` does not stop a page being deployed —
 * it only asks a crawler to stay away, while the page stays live at a URL
 * anyone can share. A release build must not contain those routes at all.
 *
 * This runs at `astro:build:done` and removes the emitted directory. The
 * earlier attempt filtered the route list at `astro:routes:resolved`, which
 * does not work: that hook reports the resolved routes, and mutating the
 * array does not stop them being generated. Deleting the output is
 * unambiguous, and the assertion below makes a silent failure impossible.
 *
 * Preview and local builds keep Workshop, because that is where it is
 * reviewed. See `config/workshop-release.ts` for the switch.
 */
export function workshopReleaseGate(): AstroIntegration {
  return {
    name: 'workshop-release-gate',
    hooks: {
      'astro:build:done': async ({ dir, pages, logger }) => {
        if (isWorkshopInBuild()) return

        const built = pages.filter(
          (page) =>
            page.pathname === 'workshop' ||
            page.pathname.startsWith('workshop/')
        ).length

        const root = fileURLToPath(dir)
        await rm(join(root, 'workshop'), { recursive: true, force: true })

        // The whole point of this integration is that nothing ships. If the
        // directory is somehow still there, fail the build rather than let a
        // release go out with it.
        const { existsSync } = await import('node:fs')
        if (existsSync(join(root, 'workshop'))) {
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
