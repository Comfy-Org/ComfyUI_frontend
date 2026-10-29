import { comfyPageFixture as defaultTest } from '@e2e/fixtures/ComfyPage'
import { createMockRelease } from '@e2e/fixtures/helpers/HelpCenterHelper'
import { releaseNotificationFixture as test } from '@e2e/fixtures/releaseNotificationFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import { expect } from '@playwright/test'

test.describe('Release Notifications', () => {
  test.describe('Release information', () => {
    test.use({
      releaseResponse: {
        status: 200,
        body: [
          createMockRelease({
            version: 'v0.3.44',
            published_at: '2026-01-01T00:00:00Z',
            content:
              '## New Features\n\n- Added awesome feature\n- Fixed important bug'
          })
        ]
      }
    })

    test('should show help center with release information', async ({
      comfyPage
    }) => {
      // Open help center
      const helpCenterButton = comfyPage.page.locator('.comfy-help-center-btn')
      await helpCenterButton.waitFor({ state: 'visible' })
      await helpCenterButton.click()

      // Verify help center menu appears
      const helpMenu = comfyPage.page.locator('.help-center-menu')
      await expect(helpMenu).toBeVisible()

      // Verify "What's New?" section shows the release
      const whatsNewSection = comfyPage.page.getByTestId(
        TestIds.dialogs.whatsNewSection
      )
      await expect(whatsNewSection).toBeVisible()

      // Should show the release version
      await expect(
        whatsNewSection.locator('text=Comfy v0.3.44 Release')
      ).toBeVisible()

      // Close help center by dismissable mask
      await comfyPage.page.locator('.help-center-backdrop').click()
      await expect(helpMenu).toBeHidden()
    })
  })

  defaultTest(
    'should not show release notifications when mocked (default behavior)',
    async ({ comfyPage }) => {
      // Open help center
      const helpCenterButton = comfyPage.page.locator('.comfy-help-center-btn')
      await helpCenterButton.waitFor({ state: 'visible' })
      await helpCenterButton.click()

      // Verify help center menu appears
      const helpMenu = comfyPage.page.locator('.help-center-menu')
      await expect(helpMenu).toBeVisible()

      // Verify "What's New?" section shows no releases
      const whatsNewSection = comfyPage.page.getByTestId(
        TestIds.dialogs.whatsNewSection
      )
      await expect(whatsNewSection).toBeVisible()

      // Should show "No recent releases" message
      await expect(
        whatsNewSection.locator('text=No recent releases')
      ).toBeVisible()

      // Should not show any popups or toasts
      await expect(comfyPage.page.locator('.whats-new-popup')).toBeHidden()
      await expect(
        comfyPage.page.locator('.release-notification-toast')
      ).toBeHidden()
    }
  )

  test.describe('API error', () => {
    test.use({
      releaseResponse: {
        status: 500,
        body: { error: 'Server error', message: 'Server error' }
      }
    })

    test('should handle release API errors gracefully', async ({
      comfyPage
    }) => {
      // Open help center
      const helpCenterButton = comfyPage.page.locator('.comfy-help-center-btn')
      await helpCenterButton.waitFor({ state: 'visible' })
      await helpCenterButton.click()

      // Verify help center still works despite API error
      const helpMenu = comfyPage.page.locator('.help-center-menu')
      await expect(helpMenu).toBeVisible()

      // Should show no releases due to error
      const whatsNewSection = comfyPage.page.getByTestId(
        TestIds.dialogs.whatsNewSection
      )
      await expect(
        whatsNewSection.locator('text=No recent releases')
      ).toBeVisible()
    })
  })

  test.describe('Disabled with releases', () => {
    test.use({
      initialSettings: { 'Comfy.Notification.ShowVersionUpdates': false },
      releaseResponse: {
        status: 200,
        body: [
          createMockRelease({
            version: 'v0.3.44',
            published_at: '2026-01-01T00:00:00Z',
            attention: 'high'
          })
        ]
      }
    })

    test('should hide "What\'s New" section when notifications are disabled', async ({
      comfyPage
    }) => {
      // Open help center
      const helpCenterButton = comfyPage.page.locator('.comfy-help-center-btn')
      await helpCenterButton.waitFor({ state: 'visible' })
      await helpCenterButton.click()

      // Verify help center menu appears
      const helpMenu = comfyPage.page.locator('.help-center-menu')
      await expect(helpMenu).toBeVisible()

      // Verify "What's New?" section is hidden
      const whatsNewSection = comfyPage.page.getByTestId(
        TestIds.dialogs.whatsNewSection
      )
      await expect(whatsNewSection).toBeHidden()

      // Should not show any popups or toasts
      await expect(comfyPage.page.locator('.whats-new-popup')).toBeHidden()
      await expect(
        comfyPage.page.locator('.release-notification-toast')
      ).toBeHidden()
    })
  })

  test.describe('Disabled API requests', () => {
    test.use({
      initialSettings: { 'Comfy.Notification.ShowVersionUpdates': false }
    })

    test('should not make API calls when notifications are disabled', async ({
      comfyPage,
      releaseRequests
    }) => {
      await expect(comfyPage.canvas).toBeVisible()
      expect(releaseRequests).toHaveLength(0)
    })
  })

  test.describe('Enabled notifications', () => {
    test.use({
      initialSettings: { 'Comfy.Notification.ShowVersionUpdates': true },
      releaseResponse: {
        status: 200,
        body: [
          createMockRelease({
            version: 'v0.3.44',
            published_at: '2026-01-01T00:00:00Z'
          })
        ]
      }
    })

    test('should show "What\'s New" section when notifications are enabled', async ({
      comfyPage
    }) => {
      // Open help center
      const helpCenterButton = comfyPage.page.locator('.comfy-help-center-btn')
      await helpCenterButton.waitFor({ state: 'visible' })
      await helpCenterButton.click()

      // Verify help center menu appears
      const helpMenu = comfyPage.page.locator('.help-center-menu')
      await expect(helpMenu).toBeVisible()

      // Verify "What's New?" section is visible
      const whatsNewSection = comfyPage.page.getByTestId(
        TestIds.dialogs.whatsNewSection
      )
      await expect(whatsNewSection).toBeVisible()

      // Should show the release
      await expect(
        whatsNewSection.locator('text=Comfy v0.3.44 Release')
      ).toBeVisible()
    })
  })

  test.describe('Runtime setting changes', () => {
    test.use({
      initialSettings: { 'Comfy.Notification.ShowVersionUpdates': true },
      releaseResponse: {
        status: 200,
        body: [
          createMockRelease({
            version: 'v0.3.44',
            published_at: '2026-01-01T00:00:00Z',
            attention: 'low',
            content: '## Bug Fixes\n\n- Fixed minor issue'
          })
        ]
      }
    })

    test('should toggle "What\'s New" section when setting changes', async ({
      comfyPage
    }) => {
      // Open help center
      const helpCenterButton = comfyPage.page.locator('.comfy-help-center-btn')
      await helpCenterButton.waitFor({ state: 'visible' })
      await helpCenterButton.click()

      // Verify "What's New?" section is visible
      const whatsNewSection = comfyPage.page.getByTestId(
        TestIds.dialogs.whatsNewSection
      )
      await expect(whatsNewSection).toBeVisible()

      // Close help center
      await comfyPage.page.locator('.help-center-backdrop').click()

      // Disable notifications
      await comfyPage.settings.setSetting(
        'Comfy.Notification.ShowVersionUpdates',
        false
      )

      // Reopen help center
      await helpCenterButton.click()

      // Verify "What's New?" section is now hidden
      await expect(whatsNewSection).toBeHidden()
    })
  })

  test.describe('Disabled with empty releases', () => {
    test.use({
      initialSettings: { 'Comfy.Notification.ShowVersionUpdates': false }
    })

    test('should handle edge case with empty releases and disabled notifications', async ({
      comfyPage
    }) => {
      // Open help center
      const helpCenterButton = comfyPage.page.locator('.comfy-help-center-btn')
      await helpCenterButton.waitFor({ state: 'visible' })
      await helpCenterButton.click()

      // Verify help center still works
      const helpMenu = comfyPage.page.locator('.help-center-menu')
      await expect(helpMenu).toBeVisible()

      // Section should be hidden regardless of empty releases
      const whatsNewSection = comfyPage.page.getByTestId(
        TestIds.dialogs.whatsNewSection
      )
      await expect(whatsNewSection).toBeHidden()
    })
  })
})
