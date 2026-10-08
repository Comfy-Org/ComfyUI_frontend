import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import type { ModelTab } from './model-tabs'
import { MODEL_TABS } from './model-tabs'
import { modelTabCounts, shownTabGroups } from './model-tab-counts'
import type { OpenWeightModel } from './open-weight-models'
import { OPEN_WEIGHT_MODELS } from './open-weight-models'

const hosted: WorkshopModel[] = [
  {
    slug: 'kling-ai',
    name: 'Kling AI',
    workflowCount: 3,
    routerId: 'kling/kling-ai',
    capabilities: [],
    modality: 'video'
  },
  {
    slug: 'upscaler',
    name: 'Sharp Upscaler',
    workflowCount: 2,
    routerId: 'acme/upscaler',
    capabilities: ['upscale'],
    modality: 'image',
    useCases: ['edit-images']
  }
]

function openWeightsOf(keep: (model: OpenWeightModel) => boolean) {
  return OPEN_WEIGHT_MODELS.filter(keep).length
}

describe('modelTabCounts', () => {
  const counts = modelTabCounts(hosted, OPEN_WEIGHT_MODELS)

  it.for<{ tab: ModelTab; expected: number }>([
    { tab: 'all', expected: 2 },
    { tab: 'partner', expected: 2 },
    { tab: 'open', expected: OPEN_WEIGHT_MODELS.length },
    {
      tab: 'video',
      expected: 1 + openWeightsOf((model) => model.modality === 'video')
    },
    {
      tab: 'image',
      expected: 1 + openWeightsOf((model) => model.modality === 'image')
    },
    {
      tab: 'upscale',
      expected: 1 + openWeightsOf((model) => model.tasks.includes('upscale'))
    },
    { tab: 'llm', expected: 0 }
  ])('counts what $tab lists before any search', ({ tab, expected }) => {
    expect(counts.get(tab)).toBe(expected)
  })

  it('counts every tab', () => {
    expect([...counts.keys()]).toEqual([...MODEL_TABS])
  })
})

describe('shownTabGroups', () => {
  const everyTab = new Map(
    MODEL_TABS.map((tab): [ModelTab, number] => [tab, 1])
  )

  it('groups the tabs as Type, Task and Access', () => {
    expect(shownTabGroups(everyTab).map((group) => group.tabs)).toEqual([
      ['all', 'image', 'video', 'audio', '3d', 'llm'],
      ['edit', 'upscale'],
      ['open', 'partner']
    ])
  })

  it('leaves out a tab that lists nothing, and a group left without tabs', () => {
    const counts = new Map<ModelTab, number>([
      ...everyTab,
      ['llm', 0],
      ['edit', 0],
      ['upscale', 0]
    ])
    expect(shownTabGroups(counts)).toEqual([
      {
        titleKey: 'workshop.explorer.tabs.groups.type',
        tabs: ['all', 'image', 'video', 'audio', '3d']
      },
      {
        titleKey: 'workshop.explorer.tabs.groups.access',
        tabs: ['open', 'partner']
      }
    ])
  })
})
