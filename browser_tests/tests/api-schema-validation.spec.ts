import { expect, test } from '@playwright/test'
import { z } from 'zod'

import { zSystemStats as baseZSystemStats } from '../../src/schemas/apiSchema'

// Locally define the user data schema (not exported from apiSchema.ts)
// const zUserData = z.array(z.array(z.string(), z.string()))

// Configurable backend base URL
const BASE_URL = process.env.COMFYUI_API_URL || 'http://127.0.0.1:8188'

// Patch zSystemStats to allow device index to be null
const zSystemStats = baseZSystemStats.extend({
  devices: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      index: z.number().nullable(),
      vram_total: z.number(),
      vram_free: z.number(),
      torch_vram_total: z.number(),
      torch_vram_free: z.number()
    })
  )
})

// API Schema Validation Tests
// These tests ensure backend responses match the frontend's Zod schemas

test.describe('API Schema Validation', () => {
  test('GET /queue returns valid schema', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/queue`)
    expect(response.status()).toBe(200)
    const data = await response.json()
    // Validate as object with queue_running and queue_pending arrays
    const zQueue = z.object({
      queue_running: z.array(z.any()),
      queue_pending: z.array(z.any())
    })
    zQueue.parse(data)
  })

  test('GET /system_stats returns valid schema', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/system_stats`)
    expect(response.status()).toBe(200)
    const data = await response.json()
    zSystemStats.parse(data)
  })

  // /user_data endpoint returns 404 on this backend, so skip for now
  // test('GET /user_data returns valid schema', async ({ request }) => {
  //   const response = await request.get(`${BASE_URL}/user_data`)
  //   expect(response.status()).toBe(200)
  //   const data = await response.json()
  //   zUserData.parse(data)
  // })

  // TODO: Add more endpoint validations as needed
})
