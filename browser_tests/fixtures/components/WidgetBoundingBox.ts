import type { Locator } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export type BoundingBoxCoord = 'x' | 'y' | 'width' | 'height'

class BoundingBoxCoordinate {
  public readonly root: Locator
  public readonly input: Locator
  public readonly incrementButton: Locator
  public readonly decrementButton: Locator

  constructor(root: Locator) {
    this.root = root
    this.input = root.locator('input')
    this.incrementButton = root.getByTestId(TestIds.widgets.increment)
    this.decrementButton = root.getByTestId(TestIds.widgets.decrement)
  }

  async read(): Promise<string> {
    return await this.input.inputValue()
  }

  async type(value: string | number): Promise<void> {
    await this.input.fill(String(value))
    await this.input.press('Enter')
  }

  async focus(): Promise<void> {
    await this.input.focus()
  }

  async increment(): Promise<void> {
    await this.incrementButton.click()
  }

  async decrement(): Promise<void> {
    await this.decrementButton.click()
  }
}

export class WidgetBoundingBoxFixture {
  public readonly root: Locator
  public readonly x: BoundingBoxCoordinate
  public readonly y: BoundingBoxCoordinate
  public readonly width: BoundingBoxCoordinate
  public readonly height: BoundingBoxCoordinate

  constructor(parent: Locator) {
    this.root = parent.getByTestId('bounding-box')
    this.x = new BoundingBoxCoordinate(this.root.getByTestId('bounding-box-x'))
    this.y = new BoundingBoxCoordinate(this.root.getByTestId('bounding-box-y'))
    this.width = new BoundingBoxCoordinate(
      this.root.getByTestId('bounding-box-width')
    )
    this.height = new BoundingBoxCoordinate(
      this.root.getByTestId('bounding-box-height')
    )
  }

  get coords(): Record<BoundingBoxCoord, BoundingBoxCoordinate> {
    return { x: this.x, y: this.y, width: this.width, height: this.height }
  }

  async readAll(): Promise<Record<BoundingBoxCoord, string>> {
    return {
      x: await this.x.read(),
      y: await this.y.read(),
      width: await this.width.read(),
      height: await this.height.read()
    }
  }
}
