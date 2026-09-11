import type { AstroIntegration } from 'astro'
// Both imported statically. A dynamic `import()` inside the hook throws
// "Vite module runner has been closed" — by `astro:build:done` the runner that
// resolves module specifiers is gone, so anything not already loaded fails.
import { existsSync } from 'node:fs'
import { readdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { DEFAULT_LOCALE, LOCALE_CODES } from '../config/locales'
import {
  assertWorkshopCloudEnvForBuild,
  isWorkshopInBuild
} from '../config/workshop-release'

/** Every locale that serves from a prefix, so each has its own output tree. */
const LOCALIZED = LOCALE_CODES.filter((locale) => locale !== DEFAULT_LOCALE)

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
 * Gates Models routes and removes the retired Workshop tree in every build.
 *
 * Workshop is unfinished, and `noindex` does not stop a page being deployed —
 * it only asks a crawler to stay away, while the page stays live at a URL
 * anyone can share. A deployed build must not contain those routes at all.
 *
 * Models routes are registered only when enabled, with the existing marketing
 * page retained at /models otherwise. The retired /workshop tree uses
 * `astro:build:done` to remove its emitted directory even when Models is on. The
 * earlier attempt filtered the route list at `astro:routes:resolved`, which
 * does not work: that hook reports the resolved routes, and mutating the
 * array does not stop them being generated. Deleting the output is
 * unambiguous. These checks cover route output, not shared CSS or translations.
 *
 * Every locale is removed, not only English. A locale serves Workshop from its
 * own prefix, so `/ja/workshop/` and `/zh-CN/workshop/` are separate trees on
 * disk; removing `dist/workshop` alone left 538 localized pages in a release
 * build, reachable and without so much as a `noindex`, while the gate logged
 * success.
 *
 * Preview builds are release builds too — a preview answers "what goes out if
 * we release right now?", so it excludes Models detail routes for the same reason.
 * Local development includes Models, as does any build asked for it explicitly. See
 * `config/workshop-release.ts` for the switch.
 *
 * A build that includes Models must also say which Cloud family
 * it talks to, and one its origin is allowed to reach; that is checked before
 * anything is generated, so a wrong family is a build error rather than a
 * preflight error in a visitor's browser.
 */
export function workshopReleaseGate(): AstroIntegration {
  return {
    name: 'workshop-release-gate',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        for (const route of modelsBuildRoutes(isWorkshopInBuild()))
          injectRoute(route)
      },
      'astro:build:start': () => {
        assertWorkshopCloudEnvForBuild()
      },
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir)
        let removed = 0
        for (const output of [
          join(root, 'workshop'),
          ...LOCALIZED.map((locale) => join(root, locale, 'workshop'))
        ]) {
          // Counted off disk rather than off Astro's route list, which omits
          // the pages the i18n fallback generates — the list reported 269 while
          // 807 were on disk, and a gate that under-reports what it removed is
          // how this went unnoticed.
          if (existsSync(output)) {
            const entries = await readdir(output, { recursive: true })
            removed += entries.filter((entry) => entry.endsWith('.html')).length
          }
          await rm(output, { recursive: true, force: true })
          if (existsSync(output)) {
            throw new Error(
              `workshop-release-gate could not remove ${output}; refusing to ship it.`
            )
          }
        }
        logger.info(`Removed ${removed} retired Workshop pages.`)
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
