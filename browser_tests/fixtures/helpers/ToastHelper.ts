import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

type ToastKind = 'error' | 'success' | 'warning' | 'loading'

const TOAST_SELECTOR = '[data-testid="toast"]'

export function toastSelector(kind: ToastKind): string {
  return `${TOAST_SELECTOR}[data-toast-kind="${kind}"]`
}

export class ToastHelper {
  public readonly panels: Locator
  public readonly toastErrors: Locator
  public readonly toastLoadings: Locator
  public readonly toastSuccesses: Locator
  public readonly toastWarnings: Locator
  public readonly visibleToasts: Locator

  constructor(page: Page) {
    this.panels = page.getByTestId(TestIds.toast.panel)
    this.toastErrors = page.locator(toastSelector('error'))
    this.toastLoadings = page.locator(toastSelector('loading'))
    this.toastSuccesses = page.locator(toastSelector('success'))
    this.toastWarnings = page.locator(toastSelector('warning'))
    this.visibleToasts = page.locator(TOAST_SELECTOR).filter({ visible: true })
  }

  withText(text: string | RegExp): Locator {
    return this.visibleToasts.filter({ hasText: text })
  }

  async dismiss(toast: Locator): Promise<void> {
    await toast.getByTestId('toast-close').click()
  }

  async closeToasts(requireCount = 0): Promise<void> {
    if (requireCount) {
      await this.visibleToasts
        .nth(requireCount - 1)
        .waitFor({ state: 'visible' })
    }

    const closeButtons = this.visibleToasts.getByTestId('toast-close')
    for (let open = await closeButtons.count(); open > 0; open--) {
      await closeButtons.first().click()
      await expect(closeButtons).toHaveCount(open - 1)
    }

    await expect(this.visibleToasts).toHaveCount(0)
  }
}
