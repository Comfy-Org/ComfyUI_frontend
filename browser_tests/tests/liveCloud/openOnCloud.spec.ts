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
            response.url() === `${cloudOrigin}/api/cloud/compatibility` &&
            response.request().method() === 'POST'
        )
        await comfyPage.page.getByTestId('cloud-button').click()
        const response = await responsePromise

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

    test('offers deployment when Cloud lacks a workflow node', async ({
      comfyPage,
      cloudOrigin
    }) => {
      await test.step('Load the workflow containing VAESave', async () => {
        await comfyPage.workflow.loadWorkflow(
          'openOnCloud/02-missing-cloud-node'
        )
      })

      await test.step('Read the missing node from the real Cloud server', async () => {
        const responsePromise = comfyPage.page.waitForResponse(
          (response) =>
            response.url() === `${cloudOrigin}/api/cloud/compatibility` &&
            response.request().method() === 'POST'
        )
        await comfyPage.page.getByTestId('cloud-button').click()
        const response = await responsePromise

        expect(response.status()).toBe(200)
        expect(await response.serverAddr()).not.toBeNull()
        const compatibility = zCloudCompatibility.parse(await response.json())
        expect(compatibility.cloud.missing_node_types).toContain('VAESave')
        expect(compatibility.cloud.missing_models).toEqual([])
      })

      await test.step('Offer the deployment', async () => {
        await expect(
          comfyPage.page.getByRole('heading', {
            name: 'Deploy your setup to Comfy Cloud',
            exact: true
          })
        ).toBeVisible()
        await comfyPage.attachScreenshot('missing-cloud-node.png', {
          runInCI: true
        })
      })
    })
  }
)
