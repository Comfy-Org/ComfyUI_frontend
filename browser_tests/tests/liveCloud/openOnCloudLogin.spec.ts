import { expect } from '@playwright/test'

import { liveOpenOnCloudLoginFixture as test } from '@e2e/fixtures/liveOpenOnCloudFixture'

test.describe(
  'Open on Cloud live sign-in handoff',
  { tag: ['@cloud-live', '@smoke', '@ui'] },
  () => {
    test('opens the selected Cloud deployment login page for a signed-out user', async ({
      comfyPage,
      cloudOrigin
    }) => {
      await test.step('Load the runnable workflow and check compatibility', async () => {
        await comfyPage.workflow.loadWorkflow(
          'openOnCloud/01-runnable-on-cloud'
        )
        await comfyPage.page.getByTestId('cloud-button').click()
        await expect(
          comfyPage.page.getByRole('heading', {
            name: 'Run on Comfy Cloud',
            exact: true
          })
        ).toBeVisible()
      })

      await test.step('Open the real Cloud sign-in page for the workflow', async () => {
        const cloudTabPromise = comfyPage.page.waitForEvent('popup')
        await comfyPage.page
          .getByRole('button', { name: 'Open on Comfy Cloud', exact: true })
          .click()
        const cloudTab = await cloudTabPromise
        await expect
          .poll(() => new URL(cloudTab.url()).origin)
          .toBe(cloudOrigin)
        await expect(
          cloudTab.getByRole('heading', {
            name: 'Log in to your account',
            exact: true
          })
        ).toBeVisible()
        await test.info().attach('cloud-sign-in.png', {
          body: await cloudTab.screenshot(),
          contentType: 'image/png'
        })
        await cloudTab.close()
      })
    })
  }
)
