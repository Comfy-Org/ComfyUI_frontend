import { expect } from '@playwright/test'

import {
  ACCOUNT_DELETION_FORM_URL,
  accountDeletionTest as test
} from '@e2e/fixtures/accountDeletionFixture'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

test.describe('User panel account deletion', { tag: ['@cloud', '@ui'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settingDialog.open()
    await comfyPage.settingDialog.category('User').click()
  })

  test('opens the Pylon deletion form prefilled with the signed-in user and tracks the click', async ({
    comfyPage,
    hostTelemetry
  }) => {
    const formPromise = comfyPage.page.waitForEvent('popup')
    await comfyPage.settingDialog.contentArea
      .getByRole('link', { name: 'Delete account' })
      .click()
    const form = new URL((await formPromise).url())

    expect(`${form.origin}${form.pathname}`).toBe(ACCOUNT_DELETION_FORM_URL)
    expect(Object.fromEntries(form.searchParams)).toEqual({
      name: 'E2E Test User',
      email: CLOUD_SELF_EMAIL,
      comfy_cloud_user_id: 'test-user-e2e'
    })
    await expect
      .poll(() =>
        hostTelemetry.filter(
          (captured) => captured.event === 'app:help_resource_clicked'
        )
      )
      .toEqual([
        {
          event: 'app:help_resource_clicked',
          properties: {
            resource_type: 'account_deletion',
            is_external: true,
            source: 'user_panel'
          }
        }
      ])
  })

  test(
    'shows the delete account link under the sign out actions',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const { contentArea } = comfyPage.settingDialog
      await expect(
        contentArea.getByRole('link', { name: 'Delete account' })
      ).toBeVisible()

      await expectElementScreenshot(
        contentArea,
        'user-panel-account-deletion.png'
      )
    }
  )
})
