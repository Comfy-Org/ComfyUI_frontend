import type { Page } from '@playwright/test'

export class SettingsHelper {
  constructor(private readonly page: Page) {}

  private async nextFrame(): Promise<void> {
    await this.page.evaluate(() => new Promise<number>(requestAnimationFrame))
  }

  async setSetting(settingId: string, settingValue: unknown): Promise<void> {
    await this.page.evaluate(
      async ({ id, value }) => {
        await window.app!.extensionManager.setting.set(id, value)
      },
      { id: settingId, value: settingValue }
    )
    await this.nextFrame()
  }

  async getSetting<T = unknown>(settingId: string): Promise<T> {
    return (await this.page.evaluate(async (id) => {
      return await window.app!.extensionManager.setting.get(id)
    }, settingId)) as T
  }
}
