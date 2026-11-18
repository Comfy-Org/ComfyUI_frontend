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

    test('opens the local workflow in Cloud after the user signs in', async ({
      comfyPage,
      cloudOrigin
    }) => {
      const email = process.env.CLOUD_ACCOUNT_EMAIL
      const password = process.env.CLOUD_ACCOUNT_PASSWORD
      if (!email || !password)
        throw new Error(
          'Set CLOUD_ACCOUNT_EMAIL and CLOUD_ACCOUNT_PASSWORD for a Cloud account that has finished onboarding. See docs/testing/open-on-cloud-e2e.md.'
        )

      await comfyPage.workflow.loadWorkflow('openOnCloud/01-runnable-on-cloud')
      await comfyPage.page.getByTestId('cloud-button').click()
      await expect(
        comfyPage.page.getByRole('heading', {
          name: 'Run on Comfy Cloud',
          exact: true
        })
      ).toBeVisible()

      const cloudTabPromise = comfyPage.page.waitForEvent('popup')
      await comfyPage.page
        .getByRole('button', { name: 'Open on Comfy Cloud', exact: true })
        .click()
      const cloudTab = await cloudTabPromise

      await test.step('Sign in with email in the Cloud tab', async () => {
        await expect
          .poll(() => new URL(cloudTab.url()).origin)
          .toBe(cloudOrigin)
        await expect(
          cloudTab.getByRole('heading', {
            name: 'Log in to your account',
            exact: true
          })
        ).toBeVisible()
        await cloudTab
          .getByRole('button', { name: 'Use email instead', exact: true })
          .click()
        await cloudTab
          .getByRole('textbox', { name: 'Email', exact: true })
          .fill(email)
        await cloudTab.getByLabel('Password', { exact: true }).fill(password)
        await cloudTab
          .getByRole('button', { name: 'Sign in', exact: true })
          .click()
      })

      await test.step('Receive the workflow from the local editor', async () => {
        await expect(
          cloudTab.getByText('Opened from ComfyUI on your computer', {
            exact: true
          })
        ).toBeVisible({ timeout: 90_000 })
        await expect(
          cloudTab.getByText("Your workflow didn't arrive", { exact: true })
        ).toHaveCount(0)
        await expect(cloudTab).not.toHaveURL(/[?&]from_local=/)
        await test.info().attach('cloud-after-sign-in.png', {
          body: await cloudTab.screenshot(),
          contentType: 'image/png'
        })
      })
    })
  }
)
