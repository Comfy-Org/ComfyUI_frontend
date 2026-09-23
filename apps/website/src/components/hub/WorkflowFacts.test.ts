import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import WorkflowFacts from './WorkflowFacts.vue'

const model = (overrides: Partial<WorkshopModel> = {}): WorkshopModel => ({
  slug: 'google--nano-banana-2--generate-images',
  name: 'Nano Banana 2',
  workflowCount: 3,
  href: '/hub/model/nanobanana2/',
  routerId: 'google/nano-banana-2',
  provider: 'Google',
  modality: 'image',
  capabilities: [],
  ...overrides
})

const props = (overrides = {}) => ({
  models: [{ name: 'Nano Banana 2', model: model() }],
  author: 'ComfyUI',
  usage: 294,
  produces: [{ media: 'image' as const, count: 1 }],
  reach: 'cloud' as const,
  openWeights: false,
  added: '2026-06-30',
  ...overrides
})

const facts = () =>
  within(screen.getByTestId('workflow-details'))
    .getAllByRole('term')
    .map((term) => term.textContent.trim())

describe('WorkflowFacts', () => {
  // The model is the one thing the form and the output leave unsaid, so it
  // leads and opens rather than sitting in the list as another value.
  it('opens the model it runs on', () => {
    render(WorkflowFacts, { props: props() })

    const link = within(screen.getByTestId('workflow-runs-on')).getByRole(
      'link',
      { name: /Nano Banana 2/ }
    )
    expect(link.getAttribute('href')).toBe('/hub/model/nanobanana2/')
  })

  it('names a model the catalogue does not carry without linking it', () => {
    render(WorkflowFacts, {
      props: props({ models: [{ name: 'Hypernova', model: undefined }] })
    })

    const runsOn = screen.getByTestId('workflow-runs-on')
    expect(runsOn.textContent).toMatch(/Hypernova/)
    expect(within(runsOn).queryByRole('link')).toBeNull()
  })

  // Each fact says which fact it is, so the column reads without the reader
  // having to infer what a bare date or a bare number stands for.
  it('labels every fact it states', () => {
    render(WorkflowFacts, { props: props() })

    expect(facts()).toEqual(['Where', 'Output', 'Runs', 'Author', 'Added'])
    expect(screen.getByTestId('workflow-details').textContent).toMatch(
      /Comfy Cloud/
    )
    expect(screen.getByTestId('workflow-details').textContent).toMatch(/294/)
  })

  // A count of nothing is not a measure of anything.
  it('leaves out a run count it does not have', () => {
    render(WorkflowFacts, { props: props({ usage: 0 }) })

    expect(facts()).not.toContain('Runs')
  })

  // Weights somebody can take away are a fact about this workflow, not about
  // every workflow, so the row appears only where it is true.
  it('states open weights only when the workflow has them', () => {
    render(WorkflowFacts, { props: props({ openWeights: true }) })

    expect(facts()).toContain('Weights')
  })

  // The page runs these against Cloud from the browser, so Cloud is where
  // they run. Only the one with a server of its own says otherwise.
  it('says a workflow runs on Cloud', () => {
    render(WorkflowFacts, { props: props() })

    expect(screen.getByTestId('workflow-details').textContent).toMatch(
      /Comfy Cloud/
    )
  })

  it('says where the one with its own deployment runs instead', () => {
    render(WorkflowFacts, { props: props({ reach: 'endpoint' as const }) })

    const said = screen.getByTestId('workflow-details').textContent
    expect(said).toMatch(/deployment of your own/)
    expect(said).not.toMatch(/Comfy Cloud/)
  })
})
