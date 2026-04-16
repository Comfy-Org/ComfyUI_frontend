import type { Locator, Page } from '@playwright/test'

import { nextFrame } from '@e2e/fixtures/utils/timing'

export class KeyboardHelper {
  constructor(
    private readonly page: Page,
    private readonly canvas: Locator
  ) {}

  async press(key: string, locator?: Locator | null): Promise<void> {
    const target = locator ?? this.canvas
    await target.press(key)
    await nextFrame(this.page)
  }

  async delete(locator?: Locator | null): Promise<void> {
    await this.press('Delete', locator)
  }

  async ctrlSend(
    keyToPress: string,
    locator: Locator | null = this.canvas
  ): Promise<void> {
    const target = locator ?? this.page.keyboard
    await target.press(`Control+${keyToPress}`)
    await nextFrame(this.page)
  }

  async altSend(
    keyToPress: string,
    locator: Locator | null = this.canvas
  ): Promise<void> {
    const target = locator ?? this.page.keyboard
    await target.press(`Alt+${keyToPress}`)
    await this.nextFrame()
  }

  async selectAll(locator?: Locator | null): Promise<void> {
    await this.ctrlSend('KeyA', locator)
  }

  async bypass(locator?: Locator | null): Promise<void> {
    await this.ctrlSend('KeyB', locator)
  }

  async collapse(locator?: Locator | null): Promise<void> {
    await this.altSend('KeyC', locator)
  }

  async undo(locator?: Locator | null): Promise<void> {
    await this.ctrlSend('KeyZ', locator)
  }

  async redo(locator?: Locator | null): Promise<void> {
    await this.ctrlSend('KeyY', locator)
  }

  async moveUp(locator?: Locator | null): Promise<void> {
    await this.ctrlSend('ArrowUp', locator)
  }

  async moveDown(locator?: Locator | null): Promise<void> {
    await this.ctrlSend('ArrowDown', locator)
  }
}
