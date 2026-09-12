import type { Locator, Page } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

/**
 * The chrome shared by every dialog rendered through `GlobalDialog` — focus
 * handling, escape dismissal, stacking and modality — as opposed to any single
 * dialog's content. Dialogs are opened through the real `dialogService` API so
 * the chrome under test is the one users get.
 */
export class DialogChrome {
  readonly dialogs: Locator
  readonly overlays: Locator

  constructor(public readonly page: Page) {
    this.dialogs = page.getByRole('dialog')
    this.overlays = page.getByTestId(TestIds.dialogs.overlay)
  }

  /**
   * Opens the core prompt dialog, whose text input carries `autofocus` — the
   * attribute `GlobalDialog` honors in place of Reka's first-tabbable default.
   */
  async openPrompt(message = 'Dialog chrome prompt'): Promise<void> {
    await this.openViaService((msg) => {
      void window
        .app!.extensionManager.dialog.prompt({
          title: 'Dialog chrome',
          message: msg,
          defaultValue: ''
        })
        .catch(() => {})
    }, message)
  }

  async openConfirm(message = 'Dialog chrome confirm'): Promise<void> {
    await this.openViaService((msg) => {
      void window
        .app!.extensionManager.dialog.confirm({
          title: 'Dialog chrome',
          type: 'default',
          message: msg
        })
        .catch(() => {})
    }, message)
  }

  async isFocusInside(container: Locator): Promise<boolean> {
    return container.evaluate((el) => el.contains(document.activeElement))
  }

  /**
   * Whether the page behind the dialog is pointer-inert. Reka's modal mode
   * disables body pointer events; the non-modal container dialogs (Settings,
   * Manager) deliberately leave the page interactive so the nested PrimeVue
   * dialogs they host keep working.
   */
  async isPageInert(): Promise<boolean> {
    return this.page.evaluate(
      () => document.body.style.pointerEvents === 'none'
    )
  }

  async stackingOrder(): Promise<number[]> {
    return this.dialogs.evaluateAll((els) =>
      els.map((el) => Number(getComputedStyle(el).zIndex))
    )
  }

  /** Dialog-store key of each open dialog, rendered by `GlobalDialog` as `aria-labelledby`. */
  async openDialogKeys(): Promise<(string | null)[]> {
    return this.dialogs.evaluateAll((els) =>
      els.map((el) => el.getAttribute('aria-labelledby'))
    )
  }

  private async openViaService(
    show: (message: string) => void,
    message: string
  ): Promise<void> {
    const before = await this.dialogs.count()
    await this.page.evaluate(show, message)
    await this.dialogs.nth(before).waitFor({ state: 'visible' })
  }
}
