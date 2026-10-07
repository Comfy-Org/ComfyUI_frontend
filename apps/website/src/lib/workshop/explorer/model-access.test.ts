import { describe, expect, it, vi } from 'vitest'

import type {
  WorkshopModel,
  WorkshopModelDetail
} from '@/config/models-catalogue'
import { workshopContract } from '@/config/workshop-contract-catalog'
import type { ModelAccess } from './model-access'
import { accessFor, offersAccess, parseAccess, runsHere } from './model-access'

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
      kind: 'a hosted model while running here is off',
      model: hosted,
      run: undefined,
      access: ['api']
    },
    {
      kind: 'a hosted model without an input schema',
      model: { ...hosted, incompleteReason: 'missing-input-schema' },
      access: []
    },
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
    run?: string
    access: ModelAccess[]
  }[])('offers $access for $kind', (testCase) => {
    vi.stubEnv(
      'PUBLIC_WORKSHOP_ROUTER_RUN',
      'run' in testCase ? testCase.run : '1'
    )
    expect(accessFor(testCase.model)).toEqual(testCase.access)
  })
})

const detail: WorkshopModelDetail = {
  ...hosted,
  fields: [],
  defaults: {},
  examples: [],
  execution: workshopContract('bfl/flux-2-pro')
}

describe('runsHere', () => {
  it.for([
    { kind: 'a catalogue entry', model: hosted, run: '1', runs: true },
    {
      kind: 'a model page with a contract',
      model: detail,
      run: '1',
      runs: true
    },
    {
      kind: 'a model page without a contract',
      model: { ...detail, execution: undefined },
      run: '1',
      runs: false
    },
    {
      kind: 'a model without an input schema',
      model: { ...hosted, incompleteReason: 'missing-input-schema' },
      run: '1',
      runs: false
    },
    { kind: 'a catalogue entry', model: hosted, run: undefined, runs: false },
    { kind: 'a model page', model: detail, run: undefined, runs: false }
  ] satisfies {
    kind: string
    model: WorkshopModel | WorkshopModelDetail
    run: string | undefined
    runs: boolean
  }[])('$kind with the run opt-in $run runs here: $runs', (testCase) => {
    vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', testCase.run)
    expect(runsHere(testCase.model)).toBe(testCase.runs)
  })
})

describe('parseAccess', () => {
  it.for([
    { search: '?use=run', access: ['run'] },
    { search: '?use=download,run', access: ['run', 'download'] },
    { search: '?use=price', access: [] },
    { search: '', access: [] }
  ] satisfies { search: string; access: ModelAccess[] }[])(
    'reads $search as $access',
    ({ search, access }) => {
      expect(parseAccess(search)).toEqual(access)
    }
  )
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
