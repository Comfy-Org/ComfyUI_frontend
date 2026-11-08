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

      await test.step('Offer the deployment and desktop agent choices', async () => {
        await expect(
          comfyPage.page.getByRole('heading', {
            name: 'Deploy your setup to Comfy Cloud',
            exact: true
          })
        ).toBeVisible()
        await comfyPage.page
          .getByRole('button', { name: 'Deploy with your agent', exact: true })
          .click()
        await expect(
          comfyPage.page.getByRole('menuitem', {
            name: 'Open in Claude desktop',
            exact: true
          })
        ).toBeVisible()
        await expect(
          comfyPage.page.getByRole('menuitem', {
            name: 'Open in Codex',
            exact: true
          })
        ).toBeVisible()
        await expect(
          comfyPage.page.getByRole('menuitem', {
            name: 'Copy prompt',
            exact: true
          })
        ).toBeVisible()
        await comfyPage.attachScreenshot('missing-cloud-node.png', {
          runInCI: true
        })
      })
    })

    test('lists the real missing model when local uploads are unavailable', async ({
      comfyPage,
      cloudOrigin
    }) => {
      await test.step('Load the workflow using the unavailable checkpoint', async () => {
        await comfyPage.workflow.loadWorkflow(
          'openOnCloud/03-missing-cloud-model'
        )
      })

      await test.step('Read the missing model from the real Cloud server', async () => {
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
        expect(compatibility.cloud.missing_models).toEqual([
          {
            folder: 'checkpoints',
            name: '3Guofeng3_v32Light.safetensors'
          }
        ])
      })

      await test.step('Identify the missing model and the upload limitation', async () => {
        const dialog = comfyPage.page.getByRole('dialog')
        await expect(
          dialog.getByRole('heading', { name: 'Missing 1 model', exact: true })
        ).toBeVisible()
        await expect(
          dialog.getByText('3Guofeng3_v32Light.safetensors', { exact: true })
        ).toBeVisible()
        await expect(
          dialog.getByText(
            'Add these models to Comfy Cloud to run this workflow. Uploads from this ComfyUI are currently unavailable.',
            { exact: true }
          )
        ).toBeVisible()
        await expect(
          dialog.getByRole('button', { name: 'Upload', exact: true })
        ).toHaveCount(0)
        await comfyPage.attachScreenshot('missing-cloud-model.png', {
          runInCI: true
        })
      })
    })
  }
)
