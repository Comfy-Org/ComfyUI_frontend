import type { Locator, Page } from '@playwright/test'

export class ClipboardHelper {
  constructor(
    private readonly page: Page,
    private readonly canvas: Locator
  ) {}

  private async nextFrame(): Promise<void> {
    await this.page.evaluate(() => new Promise<number>(requestAnimationFrame))
  }

  private async ctrlSend(
    keyToPress: string,
    locator: Locator | null = this.canvas
  ): Promise<void> {
    const target = locator ?? this.page.keyboard
    await target.press(`Control+${keyToPress}`)
    await this.nextFrame()
  }

  async copy(locator?: Locator | null): Promise<void> {
    await this.ctrlSend('KeyC', locator ?? this.canvas)
  }

  async paste(locator?: Locator | null): Promise<void> {
    await this.ctrlSend('KeyV', locator ?? this.canvas)
  }
}
