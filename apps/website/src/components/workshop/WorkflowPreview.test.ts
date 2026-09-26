import { render, screen } from '@testing-library/vue'
import { assert, describe, expect, it } from 'vitest'

import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import WorkflowPreview from './WorkflowPreview.vue'

const model = workflowDetailsBySlug.get('workflows/animate-reference-sheet')
assert(model, 'the catalogue no longer carries the fixture workflow')

const cloudHref = 'https://cloud.example.com/?template=animate-reference-sheet'

describe('WorkflowPreview', () => {
  it('puts the graph beside the ways out and what it runs on', () => {
    render(WorkflowPreview, { props: { model, cloudHref } })

    const graph = screen.getByRole('img')
    expect(graph.getAttribute('src')).toBe(
      model.workflow.template?.previewUrl ?? ''
    )

    const actions = screen.getByTestId('workflow-actions')
    expect(actions).toContainElement(
      screen.getByRole('link', { name: 'Try in Cloud' })
    )
    expect(actions).toContainElement(
      screen.getByRole('link', { name: 'Download workflow JSON' })
    )

    const runsOn = screen.getByTestId('workflow-runs-on')
    expect(runsOn).toHaveTextContent('Runs on')
    for (const name of model.workflow.template?.models ?? [])
      expect(runsOn).toHaveTextContent(name)
  })

  // Three of the design's six facts; the other three — how often it has run,
  // whether its weights are open, and when it was added — have no data behind
  // them anywhere in the catalogue.
  it('names where it runs, what it gives back, and who made it', () => {
    render(WorkflowPreview, { props: { model, cloudHref } })

    const details = screen.getByTestId('workflow-details')
    expect(details).toHaveTextContent('Runs on Comfy Cloud')
    expect(details).toHaveTextContent('Video, 1 per run')
    expect(details).toHaveTextContent(model.author ?? '')
  })

  // A workflow that gives back several of one thing says how many.
  it('counts what a run gives back', () => {
    const several = workflowDetailsBySlug.get('workflows/character-turnaround')
    assert(several, 'the catalogue no longer carries the multi-output fixture')
    expect(several.workflow.outputs).toHaveLength(3)

    render(WorkflowPreview, { props: { model: several } })

    expect(screen.getByTestId('workflow-details')).toHaveTextContent(
      'Image, 3 per run'
    )
  })

  // The template is optional on the type. Without one there is no graph and
  // nothing it runs on, but where it runs and what it gives back are the
  // workflow's own and stay.
  it('keeps the facts it owns when there is no template', () => {
    render(WorkflowPreview, {
      props: {
        model: {
          ...model,
          author: undefined,
          workflow: { ...model.workflow, template: undefined }
        }
      }
    })

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByTestId('workflow-runs-on')).toBeNull()
    expect(screen.getByTestId('workflow-details')).toHaveTextContent(
      'Runs on Comfy Cloud'
    )
    expect(screen.queryByText('Author')).toBeNull()
  })
})
