import type { GetModelsInFolderResponse } from '@comfyorg/comfyui-api-types'
import type {
  CheckCloudCompatibilityResponse,
  CompleteModelUploadResponse,
  GetFeaturesResponse,
  GetTaskResponse,
  StartModelUploadResponse
} from '@comfyorg/ingest-types'
import type { Page, Request } from '@playwright/test'

import { localSignedOutFixture } from '@e2e/fixtures/localSignedOutFixture'

export const LOCAL_MODEL_FILE = {
  name: 'e2e_local_only_lora.safetensors',
  mimeType: 'application/octet-stream',
  buffer: Buffer.from('local lora bytes for comfy cloud')
}
const UPLOAD_ID = '2f4b8c1e-6a0d-4e7b-9c3a-1d5e8f7a9b20'
const TASK_ID = '8c2d4e6f-1a3b-4c5d-9e7f-0a1b2c3d4e5f'
const STORAGE_URL = 'https://storage.e2e.test/model-uploads/lora?sig=1'
const CORS = { 'access-control-allow-origin': '*' }

interface CloudTraffic {
  starts: Request[]
  stored: Request[]
  completes: Request[]
}

function onCloud(page: Page, path: string) {
  const appOrigin = new URL(page.url()).origin
  return (url: URL) => url.origin !== appOrigin && url.pathname === path
}

async function mockComfyCloud(
  page: Page,
  modelUploadEnabled: boolean
): Promise<CloudTraffic> {
  const traffic: CloudTraffic = { starts: [], stored: [], completes: [] }
  let stored = false
  let checksAfterStorage = 0

  await page.route(onCloud(page, '/api/features'), (route) =>
    route.fulfill({
      headers: CORS,
      json: {
        open_on_cloud_enabled: true,
        ...(modelUploadEnabled && { open_on_cloud_model_upload_enabled: true }),
        model_upload_folders: ['loras', 'checkpoints']
      } satisfies GetFeaturesResponse
    })
  )
  await page.route(onCloud(page, '/api/cloud/compatibility'), (route) =>
    route.fulfill({
      headers: CORS,
      json: {
        cloud: {
          missing_node_types: [],
          missing_models:
            stored && ++checksAfterStorage > 1
              ? []
              : [{ folder: 'loras', name: LOCAL_MODEL_FILE.name }]
        }
      } satisfies CheckCloudCompatibilityResponse
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
        max_size_bytes: 26843545600,
        upload_mode: 'resumable',
        chunk_size_bytes: 67108864
      } satisfies StartModelUploadResponse
    })
  })
  await page.route(STORAGE_URL, (route) => {
    const headers = {
      ...CORS,
      'access-control-allow-methods': 'PUT, OPTIONS',
      'access-control-allow-headers': 'content-range'
    }
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers })
    traffic.stored.push(route.request())
    return route.fulfill({ status: 200, headers, body: '' })
  })
  await page.route(
    onCloud(page, `/api/assets/uploads/${UPLOAD_ID}/complete`),
    (route) => {
      traffic.completes.push(route.request())
      return route.fulfill({
        status: 202,
        headers: CORS,
        json: {
          task_id: TASK_ID,
          status: 'created'
        } satisfies CompleteModelUploadResponse
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
      } satisfies GetTaskResponse
    })
  })
  return traffic
}

export const openOnCloudModelUploadFixture = localSignedOutFixture.extend<{
  cloudTraffic: CloudTraffic
  modelUploadEnabled: boolean
}>({
  modelUploadEnabled: [true, { option: true }],
  cloudTraffic: async ({ comfyPage, modelUploadEnabled }, use) => {
    const { page } = comfyPage
    const localModel = {
      name: LOCAL_MODEL_FILE.name,
      pathIndex: 0,
      size: LOCAL_MODEL_FILE.buffer.length
    }
    await page.route('**/api/experiment/models/loras', (route) =>
      route.fulfill({ json: [localModel] satisfies GetModelsInFolderResponse })
    )
    await comfyPage.cloudAuth.mockLiveEmailSignIn()
    const cloudTraffic = await mockComfyCloud(page, modelUploadEnabled)
    await page.reload()
    await comfyPage.waitForAppReady()

    await use(cloudTraffic)
  }
})
