import type { APIRequestContext } from '@playwright/test'
import { expect } from '@playwright/test'
import { z } from 'astro/zod'

import { modelSchema } from '../../src/config/models-catalogue-data'

export async function publishedModelSlugs(request: APIRequestContext) {
  const response = await request.get('/models/catalogue.json')
  expect(response.ok()).toBe(true)
  const catalogue = z.array(modelSchema).parse(await response.json())
  const slugs = new Set(
    catalogue.flatMap((model) => (model.routerId ? [model.slug] : []))
  )
  expect(slugs.size).toBeGreaterThan(0)
  return slugs
}
