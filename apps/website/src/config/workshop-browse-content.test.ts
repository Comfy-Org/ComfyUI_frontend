import { describe, expect, it } from 'vitest'

import {
  routerModelSlugAliases,
  routerWorkshopModelPaths,
  routerWorkshopModels
} from './workshop-browse-content'
import {
  isWorkshopModelDisabled,
  workshopModelAvailability
} from './workshop-model-availability'
import { getRouterWorkshopModelDetail } from './workshop-router-content'

describe('canonical model display names', () => {
  it('does not publish editorial prices as exact Router charges', () => {
    expect(routerWorkshopModels.length).toBeGreaterThan(0)
    for (const model of routerWorkshopModels) {
      expect(model.creditsPerRun).toBeUndefined()
      expect(
        getRouterWorkshopModelDetail(model.slug)?.creditsPerRun
      ).toBeUndefined()
    }
  })

  it('does not expose Router slugs as catalogue or detail titles', () => {
    for (const model of routerWorkshopModels) {
      expect(model.name.trim()).not.toBe('')
      expect(model.name).not.toBe(model.routerId.split('/')[1])
      expect(getRouterWorkshopModelDetail(model.slug)?.name).toBe(model.name)
      expect(model.href).toBe(`/models/${model.slug}/`)
    }
  })

  it('preserves editorial names and distinguishes a native alias’s selected mode', () => {
    expect(
      getRouterWorkshopModelDetail('vertexai--gemini-3-pro-image')?.name
    ).toBe('Nano Banana Pro')
    expect(
      getRouterWorkshopModelDetail(
        'byteplus--dreamina-seedance-2-0-fast-260128'
      )?.name
    ).toBe('Seedance 2.0 Fast Text-to-Video')
  })
})

describe('model availability', () => {
  it('withholds every disabled page from the catalogue, routes and redirects', () => {
    for (const [slug, { disabled }] of workshopModelAvailability) {
      if (!disabled) continue
      expect(routerWorkshopModels.map((model) => model.slug)).not.toContain(
        slug
      )
      expect(routerWorkshopModelPaths).not.toContain(slug)
      expect(getRouterWorkshopModelDetail(slug)).toBeUndefined()
    }
    for (const target of routerModelSlugAliases.values())
      expect(isWorkshopModelDisabled(target)).toBe(false)
  })
})
