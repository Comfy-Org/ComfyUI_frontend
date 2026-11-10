import { expect } from '@playwright/test'

import { zCloudCompatibility } from '@comfyorg/ingest-types/zod'
import { liveOpenOnCloudFixture as test } from '@e2e/fixtures/liveOpenOnCloudFixture'

test.describe(
  'Open on Cloud live compatibility',
  { tag: ['@cloud-live', '@smoke', '@ui'] },
  () => {
    test('offers to open a workflow that Cloud can run', async ({
      comfyPage,
      cloudOrigin
    }) => {
      await test.step('Load the runnable workflow', async () => {
        await comfyPage.workflow.loadWorkflow(
          'openOnCloud/01-runnable-on-cloud'
        )
      })

      await test.step('Check compatibility against the real Cloud server', async () => {
        const responsePromise = comfyPage.page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/api/cloud/compatibility' &&
            response.request().method() === 'POST'
        )
        await comfyPage.page.getByTestId('cloud-button').click()
        const response = await responsePromise

        expect(new URL(response.url()).origin).toBe(cloudOrigin)
        expect(response.status()).toBe(200)
        expect(await response.serverAddr()).not.toBeNull()
        const compatibility = zCloudCompatibility.parse(await response.json())
        expect(compatibility.cloud.missing_node_types).toEqual([])
        expect(compatibility.cloud.missing_models).toEqual([])
      })

      await test.step('Offer Cloud execution with the signed-out explanation', async () => {
        await expect(
          comfyPage.page.getByRole('heading', {
            name: 'Run on Comfy Cloud',
            exact: true
          })
        ).toBeVisible()
        await expect(
          comfyPage.page.getByRole('button', {
            name: 'Open on Comfy Cloud',
            exact: true
          })
        ).toBeVisible()
        await expect(
          comfyPage.page.getByText('Comfy Cloud will ask you to sign in.', {
            exact: true
          })
        ).toBeVisible()
        await comfyPage.attachScreenshot('runnable-on-cloud.png', {
          runInCI: true
        })
      })
    })
  }
)
