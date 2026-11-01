import type { Locator, Page } from '@playwright/test'

export class InputGroups {
  readonly all: Locator
  readonly ungroupDialog: Locator

  constructor(private readonly page: Page) {
    this.all = page.getByTestId('input-group')
    this.ungroupDialog = page.getByRole('dialog', { name: 'Ungroup inputs?' })
  }

  group(name: string): Locator {
    return this.all.filter({
      has: this.page.getByRole('button', { name, exact: true })
    })
  }

  labels(name: string): Locator {
    return this.group(name).getByTestId('builder-widget-label')
  }

  widget(name: string): Locator {
    return this.page.getByLabel(`${name} — KSampler`, { exact: true })
  }

  async createFromWidget(widget: string, name: string) {
    await this.widget(widget).getByTestId('widget-actions-menu').click()
    await this.page
      .getByRole('menuitem', { name: 'New group', exact: true })
      .click()
    await this.rename(widget, name)
  }

  async rename(currentName: string, nextName: string) {
    await this.group(currentName)
      .getByRole('button', { name: 'More', exact: true })
      .click()
    await this.page
      .getByRole('menuitem', { name: 'Rename', exact: true })
      .click()
    const input = this.page.getByRole('textbox', {
      name: 'Rename',
      exact: true
    })
    await input.fill(nextName)
    await input.press('Enter')
  }

  async createEmpty(name: string) {
    await this.page
      .getByRole('button', { name: 'Create group', exact: true })
      .click()
    await this.rename('Untitled group', name)
  }

  async addWidget(widget: string, group: string) {
    await this.widget(widget).getByTestId('widget-actions-menu').click()
    await this.page
      .getByRole('menuitem', { name: `Add to group: ${group}`, exact: true })
      .click()
  }

  async requestUngroup(name: string) {
    await this.group(name)
      .getByRole('button', { name: 'More', exact: true })
      .click()
    await this.page
      .getByRole('menuitem', { name: 'Ungroup', exact: true })
      .click()
  }

  async dragWidgetToEmptyGroup(widget: string, group: string) {
    await this.dragWidget(
      widget,
      this.group(group).getByText('Add inputs to this group', { exact: true })
    )
  }

  async dragWidgetToUngroupedInput(
    widget: string,
    target: string,
    cancel = false,
    dropRatio = 0.5
  ) {
    await this.dragWidget(widget, this.widget(target), cancel, dropRatio)
  }

  async pairWidgets(source: string, target: string) {
    await this.dragWidget(source, this.widget(target))
  }

  async widgetPosition(name: string) {
    const box = await this.widget(name).boundingBox()
    if (!box) throw new Error(`Widget ${name} is not visible`)
    return { x: box.x, y: box.y }
  }

  private async dragWidget(widget: string, target: Locator, cancel = false, dropRatio = 0.5) {
    const source = this.widget(widget).getByTestId('builder-widget-label')
    await source.scrollIntoViewIfNeeded()
    await target.scrollIntoViewIfNeeded()
    const from = await source.boundingBox()
    const to = await target.boundingBox()
    if (!from || !to) throw new Error('Drag source or target is not visible')
    await this.page.mouse.move(
      from.x + from.width / 2,
      from.y + from.height / 2
    )
    await this.page.mouse.down()
    await this.page.mouse.move(to.x + to.width / 2, to.y + to.height * dropRatio, {
      steps: 20
    })
    if (cancel) await this.page.keyboard.press('Escape')
    await this.page.mouse.up()
  }
}
