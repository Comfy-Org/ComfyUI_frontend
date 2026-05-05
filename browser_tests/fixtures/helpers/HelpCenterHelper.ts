import type { Locator, Page, Route } from '@playwright/test'

import type { components } from '@comfyorg/registry-types'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

type ReleaseNote = components['schemas']['ReleaseNote']

export type HelpMenuItemKey =
  | 'feedback'
  | 'help'
  | 'docs'
  | 'discord'
  | 'github'
  | 'manager'
  | 'update-comfyui'
  | 'more'

export class HelpCenterHelper {
  public readonly button: Locator
  public readonly popup: Locator
  public readonly backdrop: Locator
  public readonly whatsNewSection: Locator

  constructor(public readonly page: Page) {
    this.button = page.getByTestId(TestIds.helpCenter.button)
    this.popup = page.getByTestId(TestIds.helpCenter.popup)
    this.backdrop = page.getByTestId(TestIds.helpCenter.backdrop)
    this.whatsNewSection = page.getByTestId(TestIds.dialogs.whatsNewSection)
  }

  menuItem(key: HelpMenuItemKey): Locator {
    return this.page.getByTestId(TestIds.helpCenter.menuItem(key))
  }

  releaseItem(version: string): Locator {
    return this.page.getByTestId(TestIds.helpCenter.releaseItem(version))
  }

  get releaseItems(): Locator {
    return this.whatsNewSection.locator('[data-testid^="help-release-item-"]')
  }

  async open(): Promise<void> {
    await this.button.waitFor({ state: 'visible' })
    await this.button.click()
    await this.popup.waitFor({ state: 'visible' })
  }

  async closeViaBackdrop(): Promise<void> {
    await this.backdrop.click()
    await this.popup.waitFor({ state: 'hidden' })
  }

  async toggle(): Promise<void> {
    await this.button.click()
  }

  /**
   * Mock the Comfy release API so the help center gets a deterministic
   * list of releases. Empty array is used when `releases` is omitted.
   */
  async mockReleases(releases: ReleaseNote[] = []): Promise<void> {
    await this.page.route('**/releases**', async (route: Route) => {
      const url = route.request().url()
      if (
        url.includes('api.comfy.org') ||
        url.includes('stagingapi.comfy.org')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(releases)
        })
      } else {
        await route.continue()
      }
    })
  }

  /**
   * Intercept the Zendesk support URL so it never actually loads in the
   * new tab opened by the Contact Support command.
   */
  async stubSupportPage(): Promise<void> {
    await this.page
      .context()
      .route('https://support.comfy.org/**', (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<html></html>'
        })
      )
  }

  /**
   * Intercept the docs.comfy.org changelog / guide pages so new tabs opened
   * by help center actions don't hit the real site during tests.
   */
  async stubDocsPage(): Promise<void> {
    await this.page
      .context()
      .route('https://docs.comfy.org/**', (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<html></html>'
        })
      )
  }

  /**
   * Intercept outbound static URLs (discord, github, ...) so new tabs
   * opened by help center actions don't navigate to the real sites.
   */
  async stubExternalPages(): Promise<void> {
    for (const pattern of [
      'https://www.comfy.org/**',
      'https://github.com/**'
    ]) {
      await this.page.context().route(pattern, (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<html></html>'
        })
      )
    }
  }
}

/**
 * Arms the `popup` listener, runs the action that triggers `window.open`,
 * then waits for the popup's initial navigation to commit so `popup.url()`
 * doesn't race and return `about:blank`. Returns a parsed `URL` and closes
 * the popup.
 *
 * @example
 * ```ts
 * const url = await waitForPopup(page, () => button.click())
 * expect(url.hostname).toBe('example.com')
 * ```
 */
export async function waitForPopup(
  page: Page,
  action: () => Promise<void>
): Promise<URL> {
  const popupPromise = page.waitForEvent('popup')
  await action()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')
  const url = new URL(popup.url())
  await popup.close()
  return url
}

export function createMockRelease(
  overrides: Partial<ReleaseNote> = {}
): ReleaseNote {
  return {
    id: 1,
    project: 'comfyui',
    version: '0.3.44',
    attention: 'medium',
    content: '## New Features\n\n- Added awesome feature',
    published_at: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Extends the main comfyPageFixture so that depending on `helpCenter`
 * automatically boots the full Comfy app (via the underlying comfyPage
 * fixture's setup). Tests only need to destructure `helpCenter`.
 */
export const helpCenterFixture = comfyPageFixture.extend<{
  helpCenter: HelpCenterHelper
}>({
  helpCenter: async ({ comfyPage }, use) => {
    await use(new HelpCenterHelper(comfyPage.page))
  }
})
