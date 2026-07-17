import type { Page, Route } from '@playwright/test'

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
   * Force server feature flags (the WS `feature_flags` handshake payload) on
   * the running app by merging into `api.serverFeatureFlags`. The `ff:`
   * localStorage override is dev-only (tree-shaken from production builds),
   * so this is the way to control `api.serverSupportsFeature()` in e2e.
   *
   * Note: this merges the injected flags at call time. A subsequent WS
   * reconnect or a late `feature_flags` handshake will full-replace
   * `serverFeatureFlags`, dropping the overrides. For flags that must survive
   * reconnects, use `mockServerFeatures()` to intercept the /api/features
   * route instead.
   */
  async setServerFlags(flags: Record<string, unknown>): Promise<void> {
    await this.page.evaluate((flagMap: Record<string, unknown>) => {
      window.app!.api.serverFeatureFlags.value = {
        ...window.app!.api.serverFeatureFlags.value,
        ...flagMap
      }
    }, flags)
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
