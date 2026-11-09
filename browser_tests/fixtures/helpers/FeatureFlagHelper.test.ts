import type { Page, Route } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'

/**
 * `seedFlags()` is what `test.use({ initialFeatureFlags: ... })` runs on, and
 * its failure mode is silent: it used to write `ff:`-prefixed localStorage
 * entries, which only `getDevOverride()` reads, and that function returns
 * early unless `import.meta.env.DEV`. CI serves a production build, so every
 * seeded flag was dropped there while the spec still passed locally against a
 * dev server. These cases pin the channel, not the call shape.
 */

type RouteHandler = (route: Route) => unknown

function fakePage() {
  const routes: { pattern: string; handler: RouteHandler }[] = []
  const initScripts: unknown[] = []
  const page = {
    route: (pattern: string, handler: RouteHandler) => {
      routes.push({ pattern, handler })
      return Promise.resolve()
    },
    addInitScript: (_script: unknown, arg: unknown) => {
      initScripts.push(arg)
      return Promise.resolve()
    }
  } as unknown as Page
  return { page, routes, initScripts }
}

/** A `/api/features` request whose upstream answers `served`, or throws it. */
function fakeRoute(served: unknown) {
  const fulfilled: { body: string }[] = []
  const route = {
    fetch: () => {
      if (served instanceof Error) return Promise.reject(served)
      return Promise.resolve({
        ok: () => true,
        json: () => Promise.resolve(served)
      })
    },
    fulfill: (response: { body: string }) => {
      fulfilled.push(response)
      return Promise.resolve()
    }
  } as unknown as Route
  return {
    route,
    body: () => JSON.parse(fulfilled.at(-1)!.body) as Record<string, unknown>
  }
}

async function seedAndServe(
  flags: Record<string, unknown>,
  served: unknown
): Promise<Record<string, unknown>> {
  const { page, routes } = fakePage()
  await new FeatureFlagHelper(page).seedFlags(flags)
  const { route, body } = fakeRoute(served)
  await routes[0].handler(route)
  return body()
}

describe('FeatureFlagHelper.seedFlags', () => {
  it('seeds through /api/features, the channel a production build reads', async () => {
    const { page, routes, initScripts } = fakePage()

    await new FeatureFlagHelper(page).seedFlags({ some_flag: true })

    expect(routes.map((r) => r.pattern)).toEqual(['**/api/features'])
    // No `ff:` localStorage write: `getDevOverride()` is gated on
    // `import.meta.env.DEV`, which is false in the build CI serves.
    expect(initScripts).toEqual([])
  })

  it('layers the seeded flags over the served config', async () => {
    expect(
      await seedAndServe(
        { onboarding_survey_enabled: false },
        { onboarding_survey_enabled: true, comfy_api_base_url: 'https://api' }
      )
    ).toEqual({
      onboarding_survey_enabled: false,
      comfy_api_base_url: 'https://api'
    })
  })

  it('serves the seeded flags alone when there is nothing upstream', async () => {
    expect(
      await seedAndServe({ some_flag: true }, new Error('no upstream'))
    ).toEqual({ some_flag: true })
  })

  it('ignores an upstream answer that is not a config object', async () => {
    expect(
      await seedAndServe({ some_flag: true }, ['not', 'a', 'config'])
    ).toEqual({ some_flag: true })
  })
})
