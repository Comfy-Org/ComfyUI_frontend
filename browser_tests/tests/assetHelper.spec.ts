import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import {
  createAssetHelper,
  withModels,
  withInputFiles,
  withOutputAssets,
  withAsset,
  withPagination,
  withUploadResponse
} from '../fixtures/helpers/AssetHelper'
import {
  STABLE_CHECKPOINT,
  STABLE_LORA,
  STABLE_INPUT_IMAGE,
  STABLE_OUTPUT
} from '../fixtures/data/assetFixtures'

test.describe('AssetHelper', () => {
  test.describe('operators and configuration', () => {
    test('creates helper with models via withModels operator', async ({
      comfyPage
    }) => {
      const helper = createAssetHelper(
        comfyPage.page,
        withModels(3, 'checkpoints')
      )
      expect(helper.assetCount).toBe(3)
      expect(
        helper.getAssets().every((a) => a.tags?.includes('checkpoints'))
      ).toBe(true)
    })

    test('composes multiple operators', async ({ comfyPage }) => {
      const helper = createAssetHelper(
        comfyPage.page,
        withModels(2, 'checkpoints'),
        withInputFiles(2),
        withOutputAssets(1)
      )
      expect(helper.assetCount).toBe(5)
    })

    test('adds individual assets via withAsset', async ({ comfyPage }) => {
      const helper = createAssetHelper(
        comfyPage.page,
        withAsset(STABLE_CHECKPOINT),
        withAsset(STABLE_LORA)
      )
      expect(helper.assetCount).toBe(2)
      expect(helper.getAsset(STABLE_CHECKPOINT.id)).toMatchObject({
        id: STABLE_CHECKPOINT.id,
        name: STABLE_CHECKPOINT.name
      })
    })

    test('withPagination sets pagination options', async ({ comfyPage }) => {
      const helper = createAssetHelper(
        comfyPage.page,
        withModels(2),
        withPagination({ total: 100, hasMore: true })
      )
      expect(helper.assetCount).toBe(2)
    })
  })

  test.describe('mock API routes', () => {
    test('GET /assets returns all assets', async ({ comfyPage }) => {
      const helper = createAssetHelper(
        comfyPage.page,
        withAsset(STABLE_CHECKPOINT),
        withAsset(STABLE_INPUT_IMAGE)
      )
      await helper.mock()

      const response = await comfyPage.page.request.get(
        `${comfyPage.url}/api/assets`
      )
      expect(response.ok()).toBe(true)

      const data = await response.json()
      expect(data.assets).toHaveLength(2)
      expect(data.total).toBe(2)
      expect(data.has_more).toBe(false)

      await helper.clearMocks()
    })

    test('GET /assets respects pagination params', async ({ comfyPage }) => {
      const helper = createAssetHelper(
        comfyPage.page,
        withModels(5),
        withPagination({ total: 10, hasMore: true })
      )
      await helper.mock()

      const response = await comfyPage.page.request.get(
        `${comfyPage.url}/api/assets?limit=2&offset=0`
      )
      const data = await response.json()
      expect(data.assets).toHaveLength(2)
      expect(data.total).toBe(10)
      expect(data.has_more).toBe(true)

      await helper.clearMocks()
    })

    test('GET /assets filters by include_tags', async ({ comfyPage }) => {
      const helper = createAssetHelper(
        comfyPage.page,
        withAsset(STABLE_CHECKPOINT),
        withAsset(STABLE_LORA),
        withAsset(STABLE_INPUT_IMAGE)
      )
      await helper.mock()

      const response = await comfyPage.page.request.get(
        `${comfyPage.url}/api/assets?include_tags=models,checkpoints`
      )
      const data = await response.json()
      expect(data.assets).toHaveLength(1)
      expect(data.assets[0].id).toBe(STABLE_CHECKPOINT.id)

      await helper.clearMocks()
    })

    test('GET /assets/:id returns single asset or 404', async ({
      comfyPage
    }) => {
      const helper = createAssetHelper(
        comfyPage.page,
        withAsset(STABLE_CHECKPOINT)
      )
      await helper.mock()

      const found = await comfyPage.page.request.get(
        `${comfyPage.url}/api/assets/${STABLE_CHECKPOINT.id}`
      )
      expect(found.ok()).toBe(true)
      const asset = await found.json()
      expect(asset.id).toBe(STABLE_CHECKPOINT.id)

      const notFound = await comfyPage.page.request.get(
        `${comfyPage.url}/api/assets/nonexistent-id`
      )
      expect(notFound.status()).toBe(404)

      await helper.clearMocks()
    })

    test('PUT /assets/:id updates asset in store', async ({ comfyPage }) => {
      const helper = createAssetHelper(
        comfyPage.page,
        withAsset(STABLE_CHECKPOINT)
      )
      await helper.mock()

      const response = await comfyPage.page.request.put(
        `${comfyPage.url}/api/assets/${STABLE_CHECKPOINT.id}`,
        { data: { name: 'renamed.safetensors' } }
      )
      expect(response.ok()).toBe(true)

      const updated = await response.json()
      expect(updated.name).toBe('renamed.safetensors')
      expect(helper.getAsset(STABLE_CHECKPOINT.id)?.name).toBe(
        'renamed.safetensors'
      )

      await helper.clearMocks()
    })

    test('DELETE /assets/:id removes asset from store', async ({
      comfyPage
    }) => {
      const helper = createAssetHelper(
        comfyPage.page,
        withAsset(STABLE_CHECKPOINT),
        withAsset(STABLE_LORA)
      )
      await helper.mock()

      const response = await comfyPage.page.request.delete(
        `${comfyPage.url}/api/assets/${STABLE_CHECKPOINT.id}`
      )
      expect(response.status()).toBe(204)
      expect(helper.assetCount).toBe(1)
      expect(helper.getAsset(STABLE_CHECKPOINT.id)).toBeUndefined()

      await helper.clearMocks()
    })

    test('POST /assets returns upload response', async ({ comfyPage }) => {
      const customUpload = {
        id: 'custom-upload-001',
        name: 'custom.safetensors',
        tags: ['models'],
        created_at: '2025-01-01T00:00:00Z',
        created_new: true
      }
      const helper = createAssetHelper(
        comfyPage.page,
        withUploadResponse(customUpload)
      )
      await helper.mock()

      const response = await comfyPage.page.request.post(
        `${comfyPage.url}/api/assets`
      )
      expect(response.status()).toBe(201)
      const data = await response.json()
      expect(data.id).toBe('custom-upload-001')
      expect(data.name).toBe('custom.safetensors')

      await helper.clearMocks()
    })

    test('POST /assets/download returns async download response', async ({
      comfyPage
    }) => {
      const helper = createAssetHelper(comfyPage.page)
      await helper.mock()

      const response = await comfyPage.page.request.post(
        `${comfyPage.url}/api/assets/download`
      )
      expect(response.status()).toBe(202)
      const data = await response.json()
      expect(data.task_id).toBe('download-task-001')
      expect(data.status).toBe('created')

      await helper.clearMocks()
    })
  })

  test.describe('mutation tracking', () => {
    test('tracks POST, PUT, DELETE mutations', async ({ comfyPage }) => {
      const helper = createAssetHelper(
        comfyPage.page,
        withAsset(STABLE_CHECKPOINT)
      )
      await helper.mock()

      await comfyPage.page.request.post(`${comfyPage.url}/api/assets`)
      await comfyPage.page.request.put(
        `${comfyPage.url}/api/assets/${STABLE_CHECKPOINT.id}`,
        { data: { name: 'updated.safetensors' } }
      )
      await comfyPage.page.request.delete(
        `${comfyPage.url}/api/assets/${STABLE_CHECKPOINT.id}`
      )

      const mutations = helper.getMutations()
      expect(mutations).toHaveLength(3)
      expect(mutations[0].method).toBe('POST')
      expect(mutations[1].method).toBe('PUT')
      expect(mutations[2].method).toBe('DELETE')

      await helper.clearMocks()
    })

    test('GET requests are not tracked as mutations', async ({
      comfyPage
    }) => {
      const helper = createAssetHelper(
        comfyPage.page,
        withAsset(STABLE_CHECKPOINT)
      )
      await helper.mock()

      await comfyPage.page.request.get(`${comfyPage.url}/api/assets`)
      await comfyPage.page.request.get(
        `${comfyPage.url}/api/assets/${STABLE_CHECKPOINT.id}`
      )

      expect(helper.getMutations()).toHaveLength(0)

      await helper.clearMocks()
    })
  })

  test.describe('mockError', () => {
    test('returns error status for all asset routes', async ({
      comfyPage
    }) => {
      const helper = createAssetHelper(comfyPage.page)
      await helper.mockError(503, 'Service Unavailable')

      const response = await comfyPage.page.request.get(
        `${comfyPage.url}/api/assets`
      )
      expect(response.status()).toBe(503)
      const data = await response.json()
      expect(data.error).toBe('Service Unavailable')

      await helper.clearMocks()
    })
  })

  test.describe('clearMocks', () => {
    test('resets store, mutations, and unroutes handlers', async ({
      comfyPage
    }) => {
      const helper = createAssetHelper(
        comfyPage.page,
        withAsset(STABLE_CHECKPOINT)
      )
      await helper.mock()

      await comfyPage.page.request.post(`${comfyPage.url}/api/assets`)
      expect(helper.getMutations()).toHaveLength(1)
      expect(helper.assetCount).toBe(1)

      await helper.clearMocks()
      expect(helper.getMutations()).toHaveLength(0)
      expect(helper.assetCount).toBe(0)
    })
  })

  test.describe('fixture generators', () => {
    test('generateModels produces deterministic assets', async ({
      comfyPage
    }) => {
      const helper = createAssetHelper(comfyPage.page, withModels(3, 'loras'))
      const assets = helper.getAssets()

      expect(assets).toHaveLength(3)
      expect(assets.every((a) => a.tags?.includes('loras'))).toBe(true)
      expect(assets.every((a) => a.tags?.includes('models'))).toBe(true)

      const ids = assets.map((a) => a.id)
      expect(new Set(ids).size).toBe(3)
    })

    test('generateInputFiles produces deterministic input assets', async ({
      comfyPage
    }) => {
      const helper = createAssetHelper(comfyPage.page, withInputFiles(3))
      const assets = helper.getAssets()

      expect(assets).toHaveLength(3)
      expect(assets.every((a) => a.tags?.includes('input'))).toBe(true)
    })

    test('generateOutputAssets produces deterministic output assets', async ({
      comfyPage
    }) => {
      const helper = createAssetHelper(comfyPage.page, withOutputAssets(5))
      const assets = helper.getAssets()

      expect(assets).toHaveLength(5)
      expect(assets.every((a) => a.tags?.includes('output'))).toBe(true)
      expect(assets.every((a) => a.name.startsWith('ComfyUI_'))).toBe(true)
    })

    test('stable fixtures have expected properties', async ({ comfyPage }) => {
      const helper = createAssetHelper(
        comfyPage.page,
        withAsset(STABLE_CHECKPOINT),
        withAsset(STABLE_LORA),
        withAsset(STABLE_INPUT_IMAGE),
        withAsset(STABLE_OUTPUT)
      )

      const checkpoint = helper.getAsset(STABLE_CHECKPOINT.id)!
      expect(checkpoint.tags).toContain('checkpoints')
      expect(checkpoint.size).toBeGreaterThan(0)
      expect(checkpoint.created_at).toBeTruthy()

      const lora = helper.getAsset(STABLE_LORA.id)!
      expect(lora.tags).toContain('loras')

      const input = helper.getAsset(STABLE_INPUT_IMAGE.id)!
      expect(input.tags).toContain('input')

      const output = helper.getAsset(STABLE_OUTPUT.id)!
      expect(output.tags).toContain('output')
    })
  })
})
