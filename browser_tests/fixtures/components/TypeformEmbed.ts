import type { Locator, Page } from '@playwright/test'

const TYPEFORM_SCRIPT = 'https://embed.typeform.com/next/embed.js'

export class TypeformEmbed {
  readonly root: Locator

  constructor(private readonly page: Page) {
    this.root = page.getByTestId('typeform-embed')
  }

  /** Keeps the container mounted without reaching Typeform, so its hidden fields stay readable. */
  async stubScript(): Promise<void> {
    await this.page.route(TYPEFORM_SCRIPT, (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: 'window.tf = { load: () => {} }'
      })
    )
  }

  hiddenField(name: string, value: string): RegExp {
    return new RegExp(`(^|,)${name}=${value}(,|$)`)
  }
}
