import { expect, mergeTests } from '@playwright/test'

import { assetApiFixture } from '@e2e/fixtures/assetApiFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  createAssetHelper,
  withModels,
  withInputFiles,
  withOutputAssets,
  withAsset,
  withPagination,
  withUploadResponse
} from '@e2e/fixtures/helpers/AssetHelper'
import {
  STABLE_CHECKPOINT,
  STABLE_LORA,
  STABLE_INPUT_IMAGE,
  STABLE_OUTPUT
} from '@e2e/fixtures/data/assetFixtures'

const test = mergeTests(comfyPageFixture, assetApiFixture)

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
    test('GET /assets returns all assets', async ({ comfyPage, assetApi }) => {
      assetApi.configure(
        withAsset(STABLE_CHECKPOINT),
        withAsset(STABLE_INPUT_IMAGE)
      )
      await assetApi.mock()

      const { status, body } = await assetApi.fetch(
        `${comfyPage.url}/api/assets`
      )
      expect(status).toBe(200)

      const data = body as {
        assets: unknown[]
        total: number
        has_more: boolean
      }
      expect(data.assets).toHaveLength(2)
      expect(data.total).toBe(2)
      expect(data.has_more).toBe(false)
    })

    test('GET /assets respects pagination params', async ({
      comfyPage,
      assetApi
    }) => {
      assetApi.configure(
        withModels(5),
        withPagination({ total: 10, hasMore: true })
      )
      await assetApi.mock()

      const { body } = await assetApi.fetch(
        `${comfyPage.url}/api/assets?limit=2&offset=0`
      )
      const data = body as {
        assets: unknown[]
        total: number
        has_more: boolean
      }
      expect(data.assets).toHaveLength(2)
      expect(data.total).toBe(10)
      expect(data.has_more).toBe(true)
    })

    test('GET /assets filters by include_tags', async ({
      comfyPage,
      assetApi
    }) => {
      assetApi.configure(
        withAsset(STABLE_CHECKPOINT),
        withAsset(STABLE_LORA),
        withAsset(STABLE_INPUT_IMAGE)
      )
      await assetApi.mock()

      const { body } = await assetApi.fetch(
        `${comfyPage.url}/api/assets?include_tags=models,checkpoints`
      )
      const data = body as { assets: Array<{ id: string }> }
      expect(data.assets).toHaveLength(1)
      expect(data.assets[0].id).toBe(STABLE_CHECKPOINT.id)
    })

    test('GET /assets/:id returns single asset or 404', async ({
      comfyPage,
      assetApi
    }) => {
      assetApi.configure(withAsset(STABLE_CHECKPOINT))
      await assetApi.mock()

      const found = await assetApi.fetch(
        `${comfyPage.url}/api/assets/${STABLE_CHECKPOINT.id}`
      )
      expect(found.status).toBe(200)
      const asset = found.body as { id: string }
      expect(asset.id).toBe(STABLE_CHECKPOINT.id)

      const notFound = await assetApi.fetch(
        `${comfyPage.url}/api/assets/nonexistent-id`
      )
      expect(notFound.status).toBe(404)
    })

    test('PUT /assets/:id updates asset in store', async ({
      comfyPage,
      assetApi
    }) => {
      assetApi.configure(withAsset(STABLE_CHECKPOINT))
      await assetApi.mock()

      const { status, body } = await assetApi.fetch(
        `${comfyPage.url}/api/assets/${STABLE_CHECKPOINT.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'renamed.safetensors' })
        }
      )
      expect(status).toBe(200)

      const updated = body as { name: string }
      expect(updated.name).toBe('renamed.safetensors')
      expect(assetApi.getAsset(STABLE_CHECKPOINT.id)?.name).toBe(
        'renamed.safetensors'
      )
    })

    test('DELETE /assets/:id removes asset from store', async ({
      comfyPage,
      assetApi
    }) => {
      assetApi.configure(withAsset(STABLE_CHECKPOINT), withAsset(STABLE_LORA))
      await assetApi.mock()

      const { status } = await assetApi.fetch(
        `${comfyPage.url}/api/assets/${STABLE_CHECKPOINT.id}`,
        { method: 'DELETE' }
      )
      expect(status).toBe(204)
      expect(assetApi.assetCount).toBe(1)
      expect(assetApi.getAsset(STABLE_CHECKPOINT.id)).toBeUndefined()
    })

    test('POST /assets returns upload response', async ({
      comfyPage,
      assetApi
    }) => {
      const customUpload = {
        id: 'custom-upload-001',
        name: 'custom.safetensors',
        tags: ['models'],
        created_at: '2025-01-01T00:00:00Z',
        created_new: true
      }
      assetApi.configure(withUploadResponse(customUpload))
      await assetApi.mock()

      const { status, body } = await assetApi.fetch(
        `${comfyPage.url}/api/assets`,
        { method: 'POST' }
      )
      expect(status).toBe(201)
      const data = body as { id: string; name: string }
      expect(data.id).toBe('custom-upload-001')
      expect(data.name).toBe('custom.safetensors')
    })

    test('POST /assets/download returns async download response', async ({
      comfyPage,
      assetApi
    }) => {
      await assetApi.mock()

      const { status, body } = await assetApi.fetch(
        `${comfyPage.url}/api/assets/download`,
        { method: 'POST' }
      )
      expect(status).toBe(202)
      const data = body as { task_id: string; status: string }
      expect(data.task_id).toBe('download-task-001')
      expect(data.status).toBe('created')
    })
  })

  test.describe('mutation tracking', () => {
    test('tracks POST, PUT, DELETE mutations', async ({
      comfyPage,
      assetApi
    }) => {
      assetApi.configure(withAsset(STABLE_CHECKPOINT))
      await assetApi.mock()

      await assetApi.fetch(`${comfyPage.url}/api/assets`, { method: 'POST' })
      await assetApi.fetch(
        `${comfyPage.url}/api/assets/${STABLE_CHECKPOINT.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'updated.safetensors' })
        }
      )
      await assetApi.fetch(
        `${comfyPage.url}/api/assets/${STABLE_CHECKPOINT.id}`,
        { method: 'DELETE' }
      )

      const mutations = assetApi.getMutations()
      expect(mutations).toHaveLength(3)
      expect(mutations[0].method).toBe('POST')
      expect(mutations[1].method).toBe('PUT')
      expect(mutations[2].method).toBe('DELETE')
    })

    test('GET requests are not tracked as mutations', async ({
      comfyPage,
      assetApi
    }) => {
      assetApi.configure(withAsset(STABLE_CHECKPOINT))
      await assetApi.mock()

      await assetApi.fetch(`${comfyPage.url}/api/assets`)
      await assetApi.fetch(
        `${comfyPage.url}/api/assets/${STABLE_CHECKPOINT.id}`
      )

      expect(assetApi.getMutations()).toHaveLength(0)
    })
  })

  test.describe('mockError', () => {
    test('returns error status for all asset routes', async ({
      comfyPage,
      assetApi
    }) => {
      await assetApi.mockError(503, 'Service Unavailable')

      const { status, body } = await assetApi.fetch(
        `${comfyPage.url}/api/assets`
      )
      expect(status).toBe(503)
      const data = body as { error: string }
      expect(data.error).toBe('Service Unavailable')
    })
  })

  test.describe('clearMocks', () => {
    test('resets store, mutations, and unroutes handlers', async ({
      comfyPage,
      assetApi
    }) => {
      assetApi.configure(withAsset(STABLE_CHECKPOINT))
      await assetApi.mock()

      await assetApi.fetch(`${comfyPage.url}/api/assets`, { method: 'POST' })
      expect(assetApi.getMutations()).toHaveLength(1)
      expect(assetApi.assetCount).toBe(1)

      await assetApi.clearMocks()
      expect(assetApi.getMutations()).toHaveLength(0)
      expect(assetApi.assetCount).toBe(0)
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
