import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

/** A combo widget as the live litegraph node holds it. */
export interface LiveComboState {
  nodeId: string
  nodeType: string
  name: string
  value: string
  options: string[]
  valueInOptions: boolean
}

/** A combo widget as the Vue node renderer paints it. */
export interface RenderedComboState {
  nodeId: string
  label: string
  text: string
  invalid: boolean
}

const COMBO_TRIGGER = 'widget-select-default-trigger'

/**
 * Reads every combo widget through two lenses: the live litegraph widget
 * (value and options list) and the rendered `WidgetSelectDefault` trigger
 * (label, text and `aria-invalid`). A red "invalid value" ring is legitimate
 * only when the live lens also shows the value missing from its options.
 */
export class ComboWidgetHelper {
  readonly triggers: Locator
  readonly invalidTriggers: Locator

  constructor(private readonly page: Page) {
    this.triggers = page.getByTestId(COMBO_TRIGGER)
    this.invalidTriggers = page.locator(
      `[data-testid="${COMBO_TRIGGER}"][aria-invalid="true"]`
    )
  }

  liveCombos(): Promise<LiveComboState[]> {
    return this.page.evaluate(() =>
      window.app!.graph.nodes.flatMap((node) =>
        (node.widgets ?? [])
          .filter((widget) => widget.type === 'combo')
          .map((widget) => {
            const raw = widget.options.values
            const resolved = typeof raw === 'function' ? raw() : raw
            const options = Array.isArray(resolved)
              ? resolved.map((option) => String(option))
              : Object.keys(resolved ?? {})
            const value = String(widget.value)
            return {
              nodeId: String(node.id),
              nodeType: node.type,
              name: widget.name,
              value,
              options,
              valueInOptions: options.includes(value)
            }
          })
      )
    )
  }

  renderedCombos(): Promise<RenderedComboState[]> {
    return this.triggers.evaluateAll((triggers) =>
      triggers.map((trigger) => ({
        nodeId:
          trigger.closest('[data-node-id]')?.getAttribute('data-node-id') ?? '',
        label: trigger.getAttribute('aria-label') ?? '',
        text: trigger.textContent.trim(),
        invalid: trigger.getAttribute('aria-invalid') === 'true'
      }))
    )
  }

  /**
   * Attaches the page as a picture plus both lenses as JSON, then asserts
   * (softly, so every lens reports) that no combo carries a legitimate stale
   * value and that no rendered combo paints the invalid ring.
   */
  async expectNoFalseRing(testInfo: TestInfo, label: string): Promise<void> {
    await expect(
      this.page.getByTestId(TestIds.widgets.widget).first()
    ).toBeVisible()
    const live = await this.liveCombos()
    const rendered = await this.renderedCombos()
    await testInfo.attach(`${label}.png`, {
      body: await this.page.screenshot({ fullPage: true }),
      contentType: 'image/png'
    })
    await testInfo.attach(`${label}.combos.json`, {
      body: JSON.stringify({ live, rendered }, null, 2),
      contentType: 'application/json'
    })

    expect
      .soft(
        live.filter((combo) => !combo.valueInOptions),
        'live combo values that are missing from their own options list'
      )
      .toEqual([])
    expect
      .soft(
        rendered.filter((combo) => combo.invalid),
        'rendered combos painting the invalid ring'
      )
      .toEqual([])
    await expect.soft(this.invalidTriggers).toHaveCount(0)
  }
}
