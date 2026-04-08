import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

/**
 * Helper for interacting with widgets rendered in app mode (linear view).
 *
 * Widgets are located by their key (format: "nodeId:widgetName") via the
 * `data-widget-key` attribute on each widget item.
 */
export class AppModeWidgetHelper {
  constructor(private readonly comfyPage: ComfyPage) {}

  private get page(): Page {
    return this.comfyPage.page
  }

  private get container(): Locator {
    return this.comfyPage.appMode.linearWidgets
  }

  /** Get a widget item container by its key (e.g. "6:text", "3:seed"). */
  getWidgetItem(key: string): Locator {
    return this.container.locator(`[data-widget-key="${key}"]`)
  }

  /** Fill a textarea widget (e.g. CLIP Text Encode prompt). */
  async fillTextarea(key: string, value: string) {
    const widget = this.getWidgetItem(key)
    await widget.locator('textarea').fill(value)
  }

  /**
   * Set a number input widget value (INT or FLOAT).
   * Targets the last input inside the widget — this works for both
   * ScrubableNumberInput (single input) and slider+InputNumber combos
   * (last input is the editable number field).
   */
  async fillNumber(key: string, value: string) {
    const widget = this.getWidgetItem(key)
    const input = widget.locator('input').last()
    await input.fill(value)
    await input.press('Enter')
  }

  /** Fill a string text input widget (e.g. filename_prefix). */
  async fillText(key: string, value: string) {
    const widget = this.getWidgetItem(key)
    await widget.locator('input').fill(value)
  }

  /** Select an option from a combo/select widget. */
  async selectOption(key: string, optionName: string) {
    const widget = this.getWidgetItem(key)
    await expect(widget.getByRole('combobox')).toBeVisible()
    await widget.getByRole('combobox').click()
    await this.page
      .getByRole('option', { name: optionName, exact: true })
      .click()
  }

  /**
   * Intercept the /api/prompt POST, click Run, and return the prompt payload.
   * Fulfills the route with a mock success response.
   */
  async runAndCapturePrompt(): Promise<
    Record<string, { inputs: Record<string, unknown> }>
  > {
    let promptBody: Record<string, { inputs: Record<string, unknown> }> | null =
      null
    await this.page.route(
      '**/api/prompt',
      async (route, req) => {
        promptBody = req.postDataJSON().prompt
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            prompt_id: 'test-id',
            number: 1,
            node_errors: {}
          })
        })
      },
      { times: 1 }
    )

    const responsePromise = this.page.waitForResponse('**/api/prompt')
    await expect(this.comfyPage.appMode.runButton).toBeVisible()
    await this.comfyPage.appMode.runButton.click()
    await responsePromise

    if (!promptBody) throw new Error('No prompt payload captured')
    return promptBody
  }
}
