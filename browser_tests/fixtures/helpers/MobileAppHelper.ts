import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

export class MobileAppHelper {
  private readonly page: Page
  readonly contentPanel: Locator
  readonly navigation: Locator
  readonly navigationTabs: Locator
  readonly outputPreview: Locator
  readonly view: Locator
  readonly workflows: Locator

  constructor(comfyPage: ComfyPage) {
    this.page = comfyPage.page
    this.view = this.page.getByTestId(TestIds.linear.mobile)
    this.contentPanel = this.view.getByRole('tabpanel').first()
    this.navigation = this.page.getByRole('tablist').filter({ hasText: 'Run' })
    this.navigationTabs = this.navigation.getByRole('tab')
    this.workflows = this.view.getByTestId(TestIds.linear.mobileWorkflows)
    this.outputPreview = this.view.getByTestId(TestIds.linear.imagePreview)
  }

  async outputPreviewWidth() {
    const box = await this.outputPreview.boundingBox()
    if (!box) throw new Error('Output preview has no layout box')
    return box.width
  }

  async switchWorkflow(workflowName: string) {
    await this.workflows.click()
    const workflow = this.page.getByRole('menuitemradio', {
      name: workflowName,
      exact: true
    })
    await workflow.click()
    await this.workflows.click()
    await expect(
      this.page.getByRole('menuitemradio', {
        name: workflowName,
        exact: true,
        checked: true
      })
    ).toBeVisible()
    await this.page.keyboard.press('Escape')
    await expect(workflow).toBeHidden()
  }
  async navigateTab(name: 'run' | 'outputs' | 'assets') {
    await this.navigation.getByRole('tab', { name }).click()
  }
  async pinch(
    locator: Locator,
    { from, to, steps = 5 }: { from: number; to: number; steps?: number }
  ) {
    const box = await locator.boundingBox()
    if (!box) throw new Error('Cannot pinch an element without a layout box')
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const touchPoints = (spread: number) => [
      { id: 1, x: center.x - spread, y: center.y },
      { id: 2, x: center.x + spread, y: center.y }
    ]
    const client = await this.page.context().newCDPSession(this.page)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: touchPoints(from)
    })
    for (let step = 1; step <= steps; step++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: touchPoints(from + ((to - from) * step) / steps)
      })
    }
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    })
    await client.detach()
  }
  async tap(locator: Locator, { count = 1 }: { count?: number } = {}) {
    for (let i = 0; i < count; i++) await locator.tap()
  }
}
