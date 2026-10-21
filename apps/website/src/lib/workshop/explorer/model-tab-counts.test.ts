import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import type { ModelTab } from './model-tabs'
import { MODEL_TABS } from './model-tabs'
import { modelTabCounts, shownTabGroups } from './model-tab-counts'
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

describe('modelTabCounts', () => {
  const counts = modelTabCounts(hosted)

  it.for<{ tab: ModelTab; expected: number }>([
    { tab: 'all', expected: 2 },
    { tab: 'video', expected: 1 },
    { tab: 'image', expected: 1 },
    { tab: 'upscale', expected: 1 },
    { tab: 'llm', expected: 0 }
  ])('counts what $tab lists before any search', ({ tab, expected }) => {
    expect(counts.get(tab)).toBe(expected)
  })

  it('counts every tab', () => {
    expect([...counts.keys()]).toEqual([...MODEL_TABS])
  })

  it('counts no tab past All, since open weights are not listed', () => {
    expect(OPEN_WEIGHT_MODELS.length).toBeGreaterThan(0)
    const all = counts.get('all') ?? 0
    for (const tab of MODEL_TABS)
      expect(counts.get(tab)).toBeLessThanOrEqual(all)
  })
})

describe('shownTabGroups', () => {
  const everyTab = new Map(
    MODEL_TABS.map((tab): [ModelTab, number] => [tab, 1])
  )

  it('groups the tabs as Type and Task, with no Access group', () => {
    expect(shownTabGroups(everyTab)).toEqual([
      {
        titleKey: 'workshop.explorer.tabs.groups.type',
        tabs: ['all', 'image', 'video', 'audio', '3d', 'llm']
      },
      {
        titleKey: 'workshop.explorer.tabs.groups.task',
        tabs: ['edit', 'upscale']
      }
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
      }
    ])
  })
})
