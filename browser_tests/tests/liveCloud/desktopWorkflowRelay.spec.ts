import { expect } from '@playwright/test'

import { desktopWorkflowRelayFixture as test } from '@e2e/fixtures/desktopWorkflowRelayFixture'

test.use({ trace: 'off' })

test.describe(
  'Desktop workflow relay transport and Cloud login',
  { tag: ['@cloud-live', '@smoke', '@ui'] },
  () => {
    test('consumes the real local transfer before opening Cloud login', async ({
      cloudOrigin,
      comfyPage,
      relayTransfer,
      request
    }) => {
      await test.step('Open the external-browser relay and consume its userdata record', async () => {
        const readPromise = comfyPage.page.waitForResponse(
          (response) =>
            response.url() === relayTransfer.fileUrl &&
            response.request().method() === 'GET'
        )
        const consumePromise = comfyPage.page.waitForResponse(
          (response) =>
            response.url() === relayTransfer.fileUrl &&
            response.request().method() === 'DELETE'
        )
        await comfyPage.page.goto(relayTransfer.url, {
          waitUntil: 'domcontentloaded'
        })
        const read = await readPromise
        const consumed = await consumePromise

        expect(read.status()).toBe(200)
        expect(await read.serverAddr()).not.toBeNull()
        expect(consumed.status()).toBe(204)
        expect(await consumed.serverAddr()).not.toBeNull()
      })

      await test.step('Reach the selected Cloud login with no reusable local transfer', async () => {
        await expect
          .poll(() => new URL(comfyPage.page.url()).origin)
          .toBe(cloudOrigin)
        await expect(
          comfyPage.page.getByRole('heading', {
            name: 'Log in to your account',
            exact: true
          })
        ).toBeVisible()
        const remaining = await request.get(relayTransfer.fileUrl, {
          headers: { 'Comfy-User': 'default' }
        })
        expect(remaining.status()).toBe(404)
        await comfyPage.attachScreenshot('desktop-relay-cloud-login.png', {
          runInCI: true
        })
      })
    })

    for (const relayState of ['missing'] as const) {
      test.describe(`${relayState} local transfer`, () => {
        test.use({ relayState })

        test('shows the transfer failure instead of navigating to Cloud', async ({
          comfyPage,
          relayTransfer
        }) => {
          await test.step('Open the stale external-browser relay link', async () => {
            await comfyPage.page.goto(relayTransfer.url, {
              waitUntil: 'domcontentloaded'
            })
          })

          await test.step('Explain that Desktop must start the transfer again', async () => {
            await expect(
              comfyPage.page.getByText(
                'Your workflow could not be transferred. Click Open on Comfy Cloud in Desktop again.',
                { exact: true }
              )
            ).toBeVisible()
            expect(new URL(comfyPage.page.url()).origin).toBe(
              new URL(comfyPage.url).origin
            )
            await comfyPage.attachScreenshot(
              `desktop-relay-${relayState}.png`,
              { runInCI: true }
            )
          })
        })
      })
    }
  }
)
