import { Locator, Page } from '@playwright/test'
export class ManageGroupNode {
  footer: Locator
  constructor(
    readonly page: Page,
    readonly root: Locator
  ) {
    this.footer = root.locator('footer')
  }
  async setLabel(name: string, label: string) {
    const active = this.root.locator('.comfy-group-manage-node-page.active')
    const input = active.getByPlaceholder(name)
    await input.fill(label)
  }
  async save() {
    await this.footer.getByText('Save').click()
  }
  async close() {
    await this.footer.getByText('Close').click()
  }
}
