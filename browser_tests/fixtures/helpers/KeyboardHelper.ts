import type { Locator, Page } from '@playwright/test'

export class KeyboardHelper {
  constructor(
    private readonly page: Page,
    private readonly canvas: Locator
  ) {}

  private async nextFrame(): Promise<void> {
    await this.page.evaluate(() => new Promise<number>(requestAnimationFrame))
  }

  async ctrlSend(
    keyToPress: string,
    locator: Locator | null = this.canvas
  ): Promise<void> {
    const target = locator ?? this.page.keyboard
    await target.press(`Control+${keyToPress}`)
    await this.nextFrame()
  }

  async selectAll(locator?: Locator | null): Promise<void> {
    await this.ctrlSend('KeyA', locator ?? this.canvas)
  }

  async bypass(locator?: Locator | null): Promise<void> {
    await this.ctrlSend('KeyB', locator ?? this.canvas)
  }

  async undo(locator?: Locator | null): Promise<void> {
    await this.ctrlSend('KeyZ', locator ?? this.canvas)
  }

  async redo(locator?: Locator | null): Promise<void> {
    await this.ctrlSend('KeyY', locator ?? this.canvas)
  }

  async moveUp(locator?: Locator | null): Promise<void> {
    await this.ctrlSend('ArrowUp', locator ?? this.canvas)
  }

  async moveDown(locator?: Locator | null): Promise<void> {
    await this.ctrlSend('ArrowDown', locator ?? this.canvas)
  }
}
