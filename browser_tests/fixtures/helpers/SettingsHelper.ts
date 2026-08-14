import type { Page } from '@playwright/test'

import { nextFrame } from '@e2e/fixtures/utils/timing'

export class SettingsHelper {
  constructor(private readonly page: Page) {}

  async setSetting(settingId: string, settingValue: unknown): Promise<void> {
    await this.page.evaluate(
      async ({ id, value }) => {
        await window.app!.extensionManager.setting.set(id, value)
      },
      { id: settingId, value: settingValue }
    )
    await nextFrame(this.page)
  }

  async getSetting<T = unknown>(settingId: string): Promise<T> {
    return (await this.page.evaluate(async (id) => {
      return await window.app!.extensionManager.setting.get(id)
    }, settingId)) as T
  }

  /**
   * Reads the value the server holds, which {@link getSetting} cannot: that
   * reports the in-memory store, where a value may have been derived at load
   * rather than persisted. Returns `undefined` for a setting never written.
   */
  async getPersistedSetting<T = unknown>(
    settingId: string
  ): Promise<T | undefined> {
    return (await this.page.evaluate(async (id) => {
      const persisted = await window.app!.api.getSettings()
      return persisted[id as keyof typeof persisted]
    }, settingId)) as T | undefined
  }
}
