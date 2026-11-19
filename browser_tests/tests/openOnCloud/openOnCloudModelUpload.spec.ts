import type { Page, Request } from '@playwright/test'
import { expect } from '@playwright/test'

import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { localSignedOutFixture as test } from '@e2e/fixtures/localSignedOutFixture'

const LORA = 'e2e_local_only_lora.safetensors'
const LORA_BYTES = Buffer.from('local lora bytes for comfy cloud')
const UPLOAD_ID = '2f4b8c1e-6a0d-4e7b-9c3a-1d5e8f7a9b20'
const TASK_ID = '8c2d4e6f-1a3b-4c5d-9e7f-0a1b2c3d4e5f'
const STORAGE_URL = 'https://storage.e2e.test/model-uploads/lora?sig=1'
const CORS = { 'access-control-allow-origin': '*' }

interface CloudTraffic {
  starts: Request[]
  stored: Buffer[]
  completes: Request[]
}

function onCloud(page: Page, path: string | RegExp) {
  const appOrigin = new URL(page.url()).origin
  return (url: URL) =>
    url.origin !== appOrigin &&
    (typeof path === 'string' ? url.pathname === path : path.test(url.pathname))
}

/**
 * Stands in for Comfy Cloud: it lacks the LoRA until the upload's task ends,
 * and takes uploads into `loras`.
 */
async function mockComfyCloud(page: Page): Promise<CloudTraffic> {
  const traffic: CloudTraffic = { starts: [], stored: [], completes: [] }
  let stored = false

  await page.route(onCloud(page, '/api/features'), (route) =>
    route.fulfill({
      headers: CORS,
      json: {
        open_on_cloud_enabled: true,
        model_upload_folders: ['loras', 'checkpoints']
      }
    })
  )
  await page.route(onCloud(page, '/api/cloud/compatibility'), (route) =>
    route.fulfill({
      headers: CORS,
      json: {
        cloud: {
          missing_node_types: [],
          missing_models: stored ? [] : [{ folder: 'loras', name: LORA }]
        }
      }
    })
  )
  await page.route(onCloud(page, '/api/assets/uploads'), (route) => {
    traffic.starts.push(route.request())
    return route.fulfill({
      status: 201,
      headers: CORS,
      json: {
        upload_id: UPLOAD_ID,
        upload_url: STORAGE_URL,
        method: 'PUT',
        headers: {},
        expires_at: '2030-01-01T00:00:00Z',
        max_size_bytes: 2147483648
      }
    })
  })
  await page.route(STORAGE_URL, (route) => {
    traffic.stored.push(route.request().postDataBuffer() ?? Buffer.alloc(0))
    return route.fulfill({ status: 200, headers: CORS, body: '' })
  })
  await page.route(
    onCloud(page, `/api/assets/uploads/${UPLOAD_ID}/complete`),
    (route) => {
      traffic.completes.push(route.request())
      return route.fulfill({
        status: 202,
        headers: CORS,
        json: { task_id: TASK_ID, status: 'created' }
      })
    }
  )
  await page.route(onCloud(page, `/api/tasks/${TASK_ID}`), (route) => {
    stored = true
    return route.fulfill({
      headers: CORS,
      json: {
        id: TASK_ID,
        idempotency_key: UPLOAD_ID,
        task_name: 'model_upload',
        status: 'completed',
        payload: {},
        create_time: '2026-11-18T00:00:00Z',
        update_time: '2026-11-18T00:00:01Z'
      }
    })
  })
  return traffic
}

test.describe('Open on Cloud: upload the models Comfy Cloud lacks', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await new FeatureFlagHelper(comfyPage.page).seedServerFlags({
      open_on_cloud_enabled: true
    })
    await comfyPage.page.route('**/api/experiment/models/loras', (route) =>
      route.fulfill({
        json: [{ name: LORA, pathIndex: 0, size: LORA_BYTES.length }]
      })
    )
    await comfyPage.page.reload()
    await comfyPage.waitForAppReady()
  })

  test('signs in, uploads the missing LoRA from this computer, then offers Run on Comfy Cloud', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    await comfyPage.cloudAuth.mockLiveEmailSignIn()
    const traffic = await mockComfyCloud(page)
    await comfyPage.workflow.loadWorkflow('openOnCloud/missing-uploadable-lora')

    await page.getByTestId('cloud-button').click()
    const card = page.getByTestId('missing-models-card')
    await expect(card.getByText(LORA)).toBeVisible()
    await card.getByRole('button', { name: 'Sign in to upload' }).click()

    const signIn = new SignInDialog(page)
    await signIn.emailInput.fill(CLOUD_SELF_EMAIL)
    await signIn.passwordInput.fill('correct-horse-battery-staple')
    await signIn.signInButton.click()
    await expect(page.locator('[data-dialog-key="global-signin"]')).toBeHidden()

    await expect(
      card.getByRole('heading', { name: 'Upload 1 model' })
    ).toBeVisible()
    await expect(card.getByText('Total 32 B')).toBeVisible()
    const upload = card.getByTestId('missing-models-upload')
    await expect(upload).toBeDisabled()

    await card.getByTestId(`choose-model-${LORA}`).setInputFiles({
      name: LORA,
      mimeType: 'application/octet-stream',
      buffer: LORA_BYTES
    })
    await upload.click()

    await expect(page.getByTestId('run-on-cloud-card')).toBeVisible()
    expect(traffic.starts).toHaveLength(1)
    expect(traffic.starts[0].postDataJSON()).toMatchObject({
      filename: LORA,
      size_bytes: LORA_BYTES.length,
      tags: ['models', 'loras']
    })
    expect(await traffic.starts[0].headerValue('authorization')).toMatch(
      /^Bearer /
    )
    expect(traffic.stored).toEqual([LORA_BYTES])
    expect(traffic.completes[0].postDataJSON()).toMatchObject({
      filename: LORA,
      tags: ['models', 'loras']
    })
  })

  test('refuses a file that is not the model the workflow uses', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    await comfyPage.cloudAuth.mockLiveEmailSignIn()
    const traffic = await mockComfyCloud(page)
    await comfyPage.workflow.loadWorkflow('openOnCloud/missing-uploadable-lora')
    await page.getByTestId('cloud-button').click()
    const card = page.getByTestId('missing-models-card')
    await card.getByRole('button', { name: 'Sign in to upload' }).click()
    const signIn = new SignInDialog(page)
    await signIn.emailInput.fill(CLOUD_SELF_EMAIL)
    await signIn.passwordInput.fill('correct-horse-battery-staple')
    await signIn.signInButton.click()
    await expect(
      card.getByRole('heading', { name: 'Upload 1 model' })
    ).toBeVisible()

    await card.getByTestId(`choose-model-${LORA}`).setInputFiles({
      name: 'another_lora.safetensors',
      mimeType: 'application/octet-stream',
      buffer: LORA_BYTES
    })

    await expect(
      card.getByText(`Choose ${LORA} from your models folder.`)
    ).toBeVisible()
    await expect(card.getByTestId('missing-models-upload')).toBeDisabled()
    expect(traffic.starts).toEqual([])
  })
})
