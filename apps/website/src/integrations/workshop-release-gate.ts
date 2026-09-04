import type { AstroIntegration } from 'astro'

import { isWorkshopInBuild, isWorkshopRoute } from '../config/workshop-release'

/**
 * Removes Workshop routes from a release build.
 *
 * This runs at `astro:routes:resolved`, before anything is rendered, so the
 * pages are never generated and never reach the deployed output. That is the
 * difference that matters: `noindex` and an absent nav link only make a page
 * hard to find, while this makes it absent.
 *
 * Preview and local builds keep the routes, because that is where Workshop is
 * reviewed. See `config/workshop-release.ts` for the switch.
 */
export function workshopReleaseGate(): AstroIntegration {
  return {
    name: 'workshop-release-gate',
    hooks: {
      'astro:routes:resolved': ({ routes, logger }) => {
        if (isWorkshopInBuild()) return

        // Mutated in place: the hook hands out the live route list, and
        // returning a new array would be ignored.
        let removed = 0
        for (let index = routes.length - 1; index >= 0; index -= 1) {
          const route = routes[index]
          if (route !== undefined && isWorkshopRoute(route.pattern)) {
            routes.splice(index, 1)
            removed += 1
          }
        }

        logger.warn(
          `Workshop is excluded from this build: ${removed} route${
            removed === 1 ? '' : 's'
          } removed. Set WORKSHOP_IN_BUILD=1 to include it.`
        )
      }
    }
  }
}
