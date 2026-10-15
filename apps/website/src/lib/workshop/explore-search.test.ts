import { describe, expect, it } from 'vitest'

import type {
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import type { CatalogueApp } from './catalogue-apps'
import { exploreRow, searchExplore } from './explore-search'

const workflow = (name: string, summary = ''): WorkflowWorkshopModel => ({
  type: 'CLOUD',
  workflowId: name,
  slug: `workflows/${name}`,
  name,
  href: `/hub/workflows/${name}/`,
  workflowCount: 0,
  capabilities: [],
  summary
})

const model = (
  name: string,
  capabilities: readonly string[] = []
): WorkshopModel => ({
  routerId: `lab/${name}`,
  slug: name,
  name,
  href: `/hub/models/${name}/`,
  workflowCount: 0,
  capabilities
})

const app = (name: string, task: string, href?: string): CatalogueApp => ({
  key: name,
  name,
  task,
  href
})

const catalogue = {
  apps: [
    app('Cinematic Studio', 'Direct every shot', '/hub/apps/cinematic-studio/'),
    app('Relight', 'Point the light where you want it.')
  ],
  workflows: [
    workflow('Match lighting', 'Relight a portrait from a reference.'),
    workflow('Upscale a video', 'Sharper footage.')
  ],
  models: [
    model('Switch Video', ['relighting']),
    model('Relight Pro'),
    model('Painter', ['text-to-image'])
  ]
}

describe('searchExplore', () => {
  it('finds every kind a query names, by name, capability or summary', () => {
    const found = searchExplore(catalogue, ' Relight ')

    expect(found.apps.map(({ name }) => name)).toEqual(['Relight'])
    expect(found.workflows.map(({ name }) => name)).toEqual(['Match lighting'])
    expect(found.models.map(({ name }) => name)).toEqual([
      'Relight Pro',
      'Switch Video'
    ])
  })

  it('finds nothing for a query nothing names', () => {
    expect(searchExplore(catalogue, 'sprite')).toEqual({
      apps: [],
      workflows: [],
      models: []
    })
  })
})

describe('exploreRow', () => {
  it('lists workflows, then apps, then models, up to the limit', () => {
    const found = searchExplore(catalogue, 'relight')

    expect(
      exploreRow(found, 3).map((entry) =>
        entry.kind === 'app' ? `app:${entry.app.name}` : entry.model.slug
      )
    ).toEqual(['workflows/Match lighting', 'app:Relight', 'Relight Pro'])
  })
})
