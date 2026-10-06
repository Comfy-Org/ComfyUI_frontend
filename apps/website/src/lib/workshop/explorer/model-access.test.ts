import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import type { ModelAccess } from './model-access'
import { accessFor, offersAccess } from './model-access'

const hosted: WorkshopModel = {
  slug: 'flux',
  name: 'Flux',
  workflowCount: 1,
  href: '/models/flux/',
  routerId: 'bfl/flux',
  capabilities: []
}

describe('accessFor', () => {
  it.for([
    { kind: 'a hosted model', model: hosted, access: ['run', 'api'] },
    {
      kind: 'a workflow',
      model: {
        slug: 'workflows/relight',
        name: 'Relight',
        workflowCount: 1,
        href: '/models/workflows/relight/',
        type: 'CLOUD',
        workflowId: 'workflows/relight',
        capabilities: []
      },
      access: []
    },
    {
      kind: 'an app',
      model: {
        slug: 'apps/studio',
        name: 'Cinematic Studio',
        workflowCount: 0,
        href: '/hub/apps/cinematic-studio/',
        type: 'APP',
        appId: 'studio',
        capabilities: []
      },
      access: []
    }
  ] satisfies {
    kind: string
    model: WorkshopModel
    access: ModelAccess[]
  }[])('offers $access for $kind', ({ model, access }) => {
    expect(accessFor(model)).toEqual(access)
  })
})

describe('offersAccess', () => {
  it.for([
    { wanted: [], offered: true },
    { wanted: ['api'], offered: true },
    { wanted: ['download'], offered: false },
    { wanted: ['download', 'run'], offered: true }
  ] satisfies { wanted: ModelAccess[]; offered: boolean }[])(
    'a hosted model answers $wanted with $offered',
    ({ wanted, offered }) => {
      expect(offersAccess(['run', 'api'], wanted)).toBe(offered)
    }
  )
})
