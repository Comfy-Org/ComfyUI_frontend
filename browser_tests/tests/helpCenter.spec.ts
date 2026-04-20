import { expect } from '@playwright/test'

import {
  createMockRelease,
  helpCenterFixture as test
} from '@e2e/fixtures/helpers/HelpCenterHelper'

test.describe('Help Center', () => {
  test.describe('popup visibility', () => {
    test('opens the popup and shows the backdrop when the sidebar button is clicked', async ({
      helpCenter
    }) => {
      await helpCenter.toggle()
      await expect(helpCenter.popup).toBeVisible()
      await expect(helpCenter.backdrop).toBeVisible()
    })

    test('closes when the backdrop is clicked', async ({ helpCenter }) => {
      await helpCenter.open()
      await helpCenter.closeViaBackdrop()
      await expect(helpCenter.popup).toBeHidden()
    })

    test('closes after clicking a menu item that opens an external tab', async ({
      helpCenter
    }) => {
      await helpCenter.stubDocsPage()
      await helpCenter.open()

      const popupPromise = helpCenter.page.waitForEvent('popup')
      await helpCenter.menuItem('docs').click()
      const externalTab = await popupPromise

      await expect(helpCenter.popup).toBeHidden()
      await externalTab.close()
    })
  })

  test.describe('popup positioning', () => {
    test('anchors to the left when sidebar location is left', async ({
      comfyPage,
      helpCenter
    }) => {
      await comfyPage.settings.setSetting('Comfy.Sidebar.Location', 'left')
      await helpCenter.open()
      await expect(helpCenter.popup).toHaveClass(/sidebar-left/)
      await expect(helpCenter.popup).not.toHaveClass(/sidebar-right/)
    })

    test('anchors to the right when sidebar location is right', async ({
      comfyPage,
      helpCenter
    }) => {
      await comfyPage.settings.setSetting('Comfy.Sidebar.Location', 'right')
      await helpCenter.open()
      await expect(helpCenter.popup).toHaveClass(/sidebar-right/)
      await expect(helpCenter.popup).not.toHaveClass(/sidebar-left/)
    })
  })

  test.describe('menu item actions', () => {
    test.beforeEach(async ({ helpCenter }) => {
      await helpCenter.stubDocsPage()
      await helpCenter.stubExternalPages()
      await helpCenter.stubSupportPage()
      await helpCenter.open()
    })

    test('Docs item opens docs.comfy.org/ in a new tab', async ({
      helpCenter
    }) => {
      const popupPromise = helpCenter.page.waitForEvent('popup')
      await helpCenter.menuItem('docs').click()
      const externalTab = await popupPromise

      const url = new URL(externalTab.url())
      expect(url.hostname).toBe('docs.comfy.org')
      expect(url.pathname).toBe('/')
      await externalTab.close()
    })

    test('Discord item opens comfy.org/discord in a new tab', async ({
      helpCenter
    }) => {
      const popupPromise = helpCenter.page.waitForEvent('popup')
      await helpCenter.menuItem('discord').click()
      const externalTab = await popupPromise

      const url = new URL(externalTab.url())
      expect(url.hostname).toBe('www.comfy.org')
      expect(url.pathname).toBe('/discord')
      await externalTab.close()
    })

    test('Github item opens the ComfyUI repo in a new tab', async ({
      helpCenter
    }) => {
      const popupPromise = helpCenter.page.waitForEvent('popup')
      await helpCenter.menuItem('github').click()
      const externalTab = await popupPromise

      const url = new URL(externalTab.url())
      expect(url.hostname).toBe('github.com')
      expect(url.pathname).toBe('/comfyanonymous/ComfyUI')
      await externalTab.close()
    })

    test('Help & Support item opens the Zendesk support form with OSS tag', async ({
      helpCenter
    }) => {
      const popupPromise = helpCenter.page.waitForEvent('popup')
      await helpCenter.menuItem('help').click()
      const externalTab = await popupPromise

      const url = new URL(externalTab.url())
      expect(url.hostname).toBe('support.comfy.org')
      expect(url.searchParams.get('tf_42243568391700')).toBe('oss')
      await externalTab.close()
    })

    test('Give Feedback item opens Contact Support in OSS mode', async ({
      helpCenter
    }) => {
      const popupPromise = helpCenter.page.waitForEvent('popup')
      await helpCenter.menuItem('feedback').click()
      const externalTab = await popupPromise

      const url = new URL(externalTab.url())
      expect(url.hostname).toBe('support.comfy.org')
      expect(url.searchParams.get('tf_42243568391700')).toBe('oss')
      await externalTab.close()
    })
  })

  test.describe("What's New releases", () => {
    test('renders only the three most recent releases', async ({
      comfyPage,
      helpCenter
    }) => {
      const versions = ['0.4.10', '0.4.9', '0.4.8', '0.4.7', '0.4.6']
      const now = Date.now()
      const releases = versions.map((version, idx) =>
        createMockRelease({
          id: idx + 1,
          version,
          published_at: new Date(now - idx * 60_000).toISOString()
        })
      )

      await helpCenter.mockReleases(releases)
      await comfyPage.setup({ mockReleases: false })
      await helpCenter.open()

      await expect(helpCenter.whatsNewSection).toBeVisible()
      await expect(helpCenter.releaseItems).toHaveCount(3)
      await expect(helpCenter.releaseItem('0.4.10')).toBeVisible()
      await expect(helpCenter.releaseItem('0.4.9')).toBeVisible()
      await expect(helpCenter.releaseItem('0.4.8')).toBeVisible()
      await expect(helpCenter.releaseItem('0.4.7')).toHaveCount(0)
    })

    test('clicking a release opens the changelog with a version anchor', async ({
      comfyPage,
      helpCenter
    }) => {
      const release = createMockRelease({ version: '0.3.50' })

      await helpCenter.mockReleases([release])
      await helpCenter.stubDocsPage()
      await comfyPage.setup({ mockReleases: false })
      await helpCenter.open()

      const popupPromise = helpCenter.page.waitForEvent('popup')
      await helpCenter.releaseItem('0.3.50').click()
      const externalTab = await popupPromise

      const url = new URL(externalTab.url())
      expect(url.hostname).toBe('docs.comfy.org')
      expect(url.pathname).toBe('/changelog')
      expect(url.hash).toBe('#v0-3-50')

      await expect(helpCenter.popup).toBeHidden()
      await externalTab.close()
    })
  })
})
