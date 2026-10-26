import { describe, expect, it } from 'vitest'

import type {
  RouterWorkshopModel,
  WorkflowWorkshopModel
} from '@/config/models-catalogue'
import { workshopPages } from '@/config/workshop-page-content'
import { workflowsUsingModel } from './model-workflows'

const workflow = (
  slug: string,
  models: readonly string[] | undefined
): WorkflowWorkshopModel => ({
  slug,
  name: slug,
  href: `/hub/workflows/${slug}/`,
  type: 'CLOUD',
  workflowId: slug,
  workflowCount: 0,
  capabilities: [],
  models
})

const hosted: RouterWorkshopModel = {
  slug: 'hosted',
  name: 'Hosted',
  routerId: 'demo/hosted',
  workflowCount: 0,
  capabilities: []
}

describe('workflowsUsingModel', () => {
  it.for([
    { model: 'Nano Banana Pro Image Edit', uses: 'Nano Banana Pro', hit: true },
    { model: 'Seedance 2.5 Video Edit', uses: 'Seedance 2.5', hit: true },
    { model: 'SeedVR2 Image Upscaler', uses: 'SeedVR2', hit: true },
    { model: 'Wan 2.6', uses: 'Wan 2.6', hit: true },
    { model: 'Seedream 4.0 Image Edit', uses: 'Seedream', hit: false },
    { model: 'FLUX Tools Erase', uses: 'Flux', hit: false },
    { model: 'Seedance 2.50 Turbo', uses: 'Seedance 2.5', hit: false }
  ])('$model uses "$uses": $hit', ({ model, uses, hit }) => {
    const page = workflow('one', [uses])
    expect(workflowsUsingModel({ name: model }, [page])).toEqual(
      hit ? [page] : []
    )
  })

  it('lists only workflows, skipping one that names no models', () => {
    const named = workflow('named', ['Nano Banana Pro'])
    expect(
      workflowsUsingModel({ name: 'Nano Banana Pro Text-to-Image' }, [
        hosted,
        workflow('unnamed', undefined),
        named
      ])
    ).toEqual([named])
  })

  it('finds the real workflows that load a hosted model', () => {
    const slugs = workflowsUsingModel(
      { name: 'Nano Banana Pro Image Edit' },
      workshopPages
    ).map((page) => page.slug)
    expect(slugs).toContain('workflows/virtual-try-on')
  })
})
