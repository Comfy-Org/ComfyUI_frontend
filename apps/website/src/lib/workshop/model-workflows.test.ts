import { describe, expect, it } from 'vitest'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import { workflowsUsingModel } from './model-workflows'

const workflow = (models: string[]): WorkflowWorkshopModel => ({
  slug: `workflows/${models.join('-')}`,
  name: `Uses ${models.join(', ')}`,
  href: `/hub/workflows/${models.join('-')}/`,
  type: 'CLOUD',
  workflowId: models.join('-'),
  workflowCount: 1,
  capabilities: [],
  models
})

describe('workflowsUsingModel', () => {
  it.for([
    { model: 'Seedream 4.5', used: 'Seedream 4.5', listed: true },
    { model: 'Flux 1 Dev', used: 'Flux 1', listed: true },
    { model: 'Kling Video 2.1', used: 'kling video', listed: true },
    { model: 'Seedream 4.5', used: 'Seedream 4', listed: false },
    { model: 'Wan 2.2', used: 'Wan 2', listed: false },
    { model: 'Seedream 4.5', used: 'Seedream', listed: false }
  ])(
    'a workflow naming "$used" lists on $model: $listed',
    ({ model, used, listed }) => {
      const pages = [workflow([used])]

      expect(workflowsUsingModel({ name: model }, pages)).toEqual(
        listed ? pages : []
      )
    }
  )

  it('lists only workflows, never models that share the name', () => {
    const router = {
      slug: 'seedream-4-5',
      name: 'Seedream 4.5',
      routerId: 'bytedance/seedream-4.5',
      workflowCount: 0,
      capabilities: []
    }

    expect(workflowsUsingModel({ name: 'Seedream 4.5' }, [router])).toEqual([])
  })
})
