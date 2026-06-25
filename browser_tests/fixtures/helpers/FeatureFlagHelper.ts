import type { Page, Route } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

export class FeatureFlagHelper {
  private featuresRouteHandler: ((route: Route) => void) | null = null

  constructor(private readonly page: Page) {}

  /**
   * Seed feature flags via `addInitScript` so they are available in
   * localStorage before the app JS executes on first load.
   * Must be called before `comfyPage.setup()` / `page.goto()`.
   *
   * Note: Playwright init scripts persist for the page lifetime and
   * cannot be removed. Call this once per test, before navigation.
   */
  async seedFlags(flags: Record<string, unknown>): Promise<void> {
    await this.page.addInitScript((flagMap: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(flagMap)) {
        localStorage.setItem(`ff:${key}`, JSON.stringify(value))
      }
    }, flags)
  }

  /**
   * Set feature flags at runtime via localStorage. Uses the `ff:` prefix
   * that devFeatureFlagOverride.ts reads in dev mode.
   * For flags needed before page init, use `seedFlags()` instead.
   */
  async setFlags(flags: Record<string, unknown>): Promise<void> {
    await this.page.evaluate((flagMap: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(flagMap)) {
        localStorage.setItem(`ff:${key}`, JSON.stringify(value))
      }
    }, flags)
  }

  async setFlag(name: string, value: unknown): Promise<void> {
    await this.setFlags({ [name]: value })
  }

  async clearFlags(): Promise<void> {
    await this.page.evaluate(() => {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('ff:')) keysToRemove.push(key)
      }
      keysToRemove.forEach((k) => {
        localStorage.removeItem(k)
      })
    })
  }

  /**
   * Set server feature flags at runtime by mutating the reactive
   * `api.serverFeatureFlags` ref. Use this when `setFlags()` (localStorage)
   * won't work — namely in production builds, where the dev-override
   * reader is gated on `import.meta.env.DEV` and dead-code-eliminated.
   *
   * Note: server features are the LOWEST-priority flag source. If the
   * backend's remote config (`/api/features`) defines the same key, the
   * remote-config value wins — use `overrideFlags()` to control flags
   * deterministically regardless of what the backend serves.
   */
  async setServerFeatures(features: Record<string, unknown>): Promise<void> {
    await this.page.evaluate((flagMap: Record<string, unknown>) => {
      const api = window.app!.api
      api.serverFeatureFlags.value = {
        ...api.serverFeatureFlags.value,
        ...flagMap
      }
    }, features)
  }

  /**
   * Deterministically override flags resolved via `useFeatureFlags()` in
   * production cloud builds, where dev overrides (the highest-priority
   * source) are compiled out. Covers both remaining sources:
   *
   * 1. Remote config — mutates the live config object in place
   *    (`window.__CONFIG__` is the same object held by the `remoteConfig`
   *    ref, whose consumers read keys lazily on access) and intercepts
   *    `/api/features` so any later refresh (auth change, 10-minute poll)
   *    re-applies the overrides instead of clobbering them.
   * 2. Server features — mutates `api.serverFeatureFlags` as a fallback
   *    for environments where remote config never loaded.
   */
  async overrideFlags(features: Record<string, unknown>): Promise<void> {
    await this.page.route('**/api/features', async (route) => {
      const response = await route.fetch()
      let config: RemoteConfig = {}
      try {
        config = (await response.json()) as RemoteConfig
      } catch {
        // Non-JSON response (e.g. backend without the endpoint); serve
        // just the overrides.
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...config, ...features })
      })
    })
    await this.page.evaluate((flagMap: Record<string, unknown>) => {
      const config = (window as { __CONFIG__?: Record<string, unknown> })
        .__CONFIG__
      if (config) Object.assign(config, flagMap)
      const api = window.app!.api
      api.serverFeatureFlags.value = {
        ...api.serverFeatureFlags.value,
        ...flagMap
      }
    }, features)
  }

  /**
   * Mock server feature flags via route interception on /api/features.
   */
  async mockServerFeatures(features: Record<string, unknown>): Promise<void> {
    this.featuresRouteHandler = (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(features)
      })
    await this.page.route('**/api/features', this.featuresRouteHandler)
  }

  async clearMocks(): Promise<void> {
    if (this.featuresRouteHandler) {
      await this.page.unroute('**/api/features', this.featuresRouteHandler)
      this.featuresRouteHandler = null
    }
  }
}
