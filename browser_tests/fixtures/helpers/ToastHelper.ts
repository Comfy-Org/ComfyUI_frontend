import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

type ToastKind = 'error' | 'success' | 'warning' | 'loading'

export function toastSelector(kind: ToastKind): string {
  return `[data-testid="toast"][data-toast-kind="${kind}"]`
}

export class ToastHelper {
  public readonly visibleToasts: Locator
  public readonly toastErrors: Locator
  public readonly toastSuccesses: Locator
  public readonly toastWarnings: Locator
  public readonly toastLoadings: Locator
  public readonly alerts: Locator

  constructor(private readonly page: Page) {
    const toasts = page.getByTestId('toast')
    this.visibleToasts = toasts.filter({ visible: true })
    this.toastErrors = page.locator(toastSelector('error'))
    this.toastSuccesses = page.locator(toastSelector('success'))
    this.toastWarnings = page.locator(toastSelector('warning'))
    this.toastLoadings = page.locator(toastSelector('loading'))
    this.alerts = toasts.and(page.getByRole('alert'))
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

    // Clear all toasts
    const toastCloseButtons = await this.page.getByTestId('toast-close').all()
    for (const button of toastCloseButtons) {
      await button.click()
    }

    // Assert all toasts are closed
    await expect(this.visibleToasts).toHaveCount(0)
  }
}
