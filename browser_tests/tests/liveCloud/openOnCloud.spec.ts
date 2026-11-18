import { zCloudCompatibility } from '@comfyorg/ingest-types/zod'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { liveOpenOnCloudFixture as test } from '@e2e/fixtures/liveOpenOnCloudFixture'

test.use({ billingNewUx: false })

async function openCloudDialog(comfyPage: ComfyPage, cloudOrigin: string) {
  const { page } = comfyPage
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url() === `${cloudOrigin}/api/cloud/compatibility` &&
        response.request().method() === 'POST'
    ),
    page.getByTestId('cloud-button').click()
  ])
  expect(response.status()).toBe(200)
  expect(await response.serverAddr()).not.toBeNull()
  return zCloudCompatibility.parse(await response.json()).cloud
}

test.describe(
  'Open on Cloud live',
  { tag: ['@cloud-live', '@smoke', '@ui'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await expect(
        comfyPage.page.getByTestId('top-menu-actionbars')
      ).toBeVisible()
    })

    test('hides the Cloud button when signed out', async ({
      comfyPage,
      cloudOrigin,
      request
    }) => {
      const response = await request.get(`${cloudOrigin}/api/features`)
      expect(response.status()).toBe(200)
      expect(await response.json()).toMatchObject({
        open_on_cloud_enabled: false
      })
      await expect(comfyPage.page.getByTestId('login-button')).toBeVisible()
      await expect(comfyPage.page.getByTestId('cloud-button')).toHaveCount(0)
    })

    test.describe('signed in', () => {
      test.beforeEach(
        'Sign in with a Cloud-enabled test account',
        async ({ comfyPage, cloudOrigin }) => {
          const email = process.env.OPEN_ON_CLOUD_ENABLED_EMAIL
          const password = process.env.OPEN_ON_CLOUD_ENABLED_PASSWORD
          if (!email || !password) {
            throw new Error(
              'Set OPEN_ON_CLOUD_ENABLED_EMAIL and OPEN_ON_CLOUD_ENABLED_PASSWORD'
            )
          }

          const { page } = comfyPage
          await page.getByTestId('login-button').click()
          const emailField = page.getByRole('textbox', {
            name: 'Email',
            exact: true
          })
          await emailField.fill(email)
          await page.getByLabel('Password', { exact: true }).fill(password)
          const [response] = await Promise.all([
            page.waitForResponse(async (response) => {
              const request = response.request()
              return (
                response.url() === `${cloudOrigin}/api/features` &&
                request.method() === 'GET' &&
                Boolean(await request.headerValue('authorization'))
              )
            }),
            page.getByRole('button', { name: 'Sign in', exact: true }).click()
          ])
          expect(response.status()).toBe(200)
          expect(await response.serverAddr()).not.toBeNull()
          expect(await response.json()).toMatchObject({
            open_on_cloud_enabled: true
          })
          await expect(page.getByTestId('current-user-button')).toBeVisible()
          await expect(emailField).toBeHidden()
        }
      )

      test('shows the Cloud button after sign-in and hides it again on sign-out', async ({
        comfyPage
      }) => {
        const { page } = comfyPage
        const cloudButton = page.getByTestId('cloud-button')
        await expect(cloudButton).toBeVisible()

        await page.getByTestId('current-user-button').click()
        await page.getByTestId('logout-menu-item').click()
        await expect(page.getByTestId('login-button')).toBeVisible()
        await expect(cloudButton).toHaveCount(0)
      })

      test('opens the Deploy with your agent dialog when Cloud lacks a node', async ({
        comfyPage,
        cloudOrigin
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'openOnCloud/02-missing-cloud-node'
        )
        const compatibility = await openCloudDialog(comfyPage, cloudOrigin)
        expect(compatibility.missing_node_types).toContain('VAESave')
        expect(compatibility.missing_models).toEqual([])

        const { page } = comfyPage
        const dialog = page.getByRole('dialog')
        await expect(
          dialog.getByRole('heading', {
            name: 'Run your workflows on Comfy Cloud',
            exact: true
          })
        ).toBeVisible()
        await dialog
          .getByRole('button', { name: 'Deploy with your agent', exact: true })
          .click()
        for (const name of [
          'Open in Claude desktop',
          'Open in Codex',
          'Copy prompt'
        ]) {
          await expect(
            page.getByRole('menuitem', { name, exact: true })
          ).toBeVisible()
        }
        await comfyPage.attachScreenshot('missing-cloud-node.png', {
          runInCI: true
        })
      })

      test('opens the Missing models dialog when Cloud lacks a checkpoint', async ({
        comfyPage,
        cloudOrigin
      }) => {
        const checkpoint = '3Guofeng3_v32Light.safetensors'
        await comfyPage.workflow.loadWorkflow(
          'openOnCloud/03-missing-cloud-model'
        )
        const compatibility = await openCloudDialog(comfyPage, cloudOrigin)
        expect(compatibility.missing_node_types).toEqual([])
        expect(compatibility.missing_models).toEqual([
          { folder: 'checkpoints', name: checkpoint }
        ])

        const dialog = comfyPage.page.getByRole('dialog')
        await expect(
          dialog.getByRole('heading', { name: 'Missing 1 model', exact: true })
        ).toBeVisible()
        await expect(
          dialog.getByText(checkpoint, { exact: true })
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

      test('offers to open a workflow that Cloud can run', async ({
        comfyPage,
        cloudOrigin
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'openOnCloud/01-runnable-on-cloud'
        )
        const compatibility = await openCloudDialog(comfyPage, cloudOrigin)
        expect(compatibility.missing_node_types).toEqual([])
        expect(compatibility.missing_models).toEqual([])

        const dialog = comfyPage.page.getByRole('dialog')
        await expect(
          dialog.getByRole('heading', {
            name: 'Run on Comfy Cloud',
            exact: true
          })
        ).toBeVisible()
        await expect(
          dialog.getByRole('button', {
            name: 'Open on Comfy Cloud',
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
