import { describe, expect, it, vi } from 'vitest'

import type { WorkshopModelEntry } from '../content/workshop-models.schema'
import { FEATURED_WORKSHOP_MODEL_IDS } from './workshop-featured'
import { resolveHomepageWorkshopModels } from './workshop-homepage'

function entry(id: string): WorkshopModelEntry {
  return {
    id,
    slug: id.replace('/', '--'),
    displayName: id,
    provider: id.split('/')[0],
    modality: 'image',
    description: '',
    tags: [],
    parameters: { type: 'object', properties: {} },
    roles: []
  }
}

describe('resolveHomepageWorkshopModels', () => {
  it('does not load or expose models when Workshop is disabled', async () => {
    const loadModels = vi.fn<() => Promise<WorkshopModelEntry[]>>()

    await expect(
      resolveHomepageWorkshopModels(false, loadModels)
    ).resolves.toEqual([])
    expect(loadModels).not.toHaveBeenCalled()
  })

  it('loads, projects, and selects the featured cards when enabled', async () => {
    const entries = [...FEATURED_WORKSHOP_MODEL_IDS].reverse().map(entry)
    const loadModels = vi.fn(async () => entries)

    await expect(
      resolveHomepageWorkshopModels(true, loadModels)
    ).resolves.toMatchObject(FEATURED_WORKSHOP_MODEL_IDS.map((id) => ({ id })))
    expect(loadModels).toHaveBeenCalledOnce()
  })
})
