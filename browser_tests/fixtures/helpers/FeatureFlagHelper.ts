import type { Page } from '@playwright/test'

export class FeatureFlagHelper {
  constructor(private readonly page: Page) {}

  /**
   * Set feature flags via localStorage. Uses the `ff:` prefix
   * that devFeatureFlagOverride.ts reads in dev mode.
   * Call BEFORE comfyPage.setup() for flags needed at init time,
   * or use page.evaluate() for runtime changes.
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
      keysToRemove.forEach((k) => localStorage.removeItem(k))
    })
  }

  /**
   * Mock server feature flags via route interception on /api/features.
   */
  async mockServerFeatures(features: Record<string, unknown>): Promise<void> {
    await this.page.route('**/api/features', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(features)
      })
    )
  }
}
