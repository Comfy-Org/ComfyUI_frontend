import type { Locator } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

/** DOM-centric helper for a single Vue-rendered node on the canvas. */
export class VueNodeFixture {
  public readonly header: Locator
  public readonly title: Locator
  public readonly titleInput: Locator
  public readonly body: Locator
  public readonly pinIndicator: Locator
  public readonly collapseButton: Locator
  public readonly collapseIcon: Locator
  public readonly root: Locator

  constructor(private readonly locator: Locator) {
    this.header = locator.locator('[data-testid^="node-header-"]')
    this.title = locator.getByTestId('node-title')
    this.titleInput = locator.getByTestId('node-title-input')
    this.body = locator.locator('[data-testid^="node-body-"]')
    this.pinIndicator = locator.getByTestId(TestIds.node.pinIndicator)
    this.collapseButton = locator.getByTestId('node-collapse-button')
    this.collapseIcon = this.collapseButton.locator('i')
    this.root = locator
  }

  get widgets(): Locator {
    return this.locator.locator('.lg-node-widget')
  }

  async getTitle(): Promise<string> {
    return (await this.title.textContent()) ?? ''
  }

  async setTitle(value: string): Promise<void> {
    await this.header.dblclick()
    const input = this.titleInput
    await input.waitFor({ state: 'visible' })
    await input.fill(value)
    await input.press('Enter')
  }

  async cancelTitleEdit(): Promise<void> {
    await this.header.dblclick()
    const input = this.titleInput
    await input.waitFor({ state: 'visible' })
    await input.press('Escape')
  }

  async toggleCollapse(): Promise<void> {
    await this.collapseButton.click()
  }

  async getCollapseIconClass(): Promise<string> {
    return (await this.collapseIcon.getAttribute('class')) ?? ''
  }

  boundingBox(): ReturnType<Locator['boundingBox']> {
    return this.locator.boundingBox()
  }
}
