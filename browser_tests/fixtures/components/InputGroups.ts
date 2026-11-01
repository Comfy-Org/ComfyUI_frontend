import type { Locator, Page } from '@playwright/test'

export class InputGroups {
  readonly all: Locator

  constructor(private readonly page: Page) {
    this.all = page.getByTestId('input-group')
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

  get ungroupDialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Ungroup inputs?' })
  }
}
