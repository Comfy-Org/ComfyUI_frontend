import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor } from '@testing-library/vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import WorkflowPreview from './WorkflowPreview.vue'

const model = workflowDetailsBySlug.get('workflows/animate-reference-sheet')
assert(model, 'the catalogue no longer carries the fixture workflow')

const cloudHref = 'https://cloud.example.com/?template=animate-reference-sheet'

const graphJson = () =>
  JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'public/workflow-graphs/animate-reference-sheet.json'
      ),
      'utf8'
    )
  ) as unknown

function servingGraph(answer: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(answer))
}

// Nothing here reaches the network: a test that says nothing about the graph
// still mounts the component that fetches it.
beforeEach(() => {
  servingGraph(async () => Response.error())
})

describe('WorkflowPreview', () => {
  it('puts the graph beside the ways out and what it runs on', () => {
    render(WorkflowPreview, { props: { model, cloudHref } })

    expect(screen.getByTestId('workflow-graph')).toBeTruthy()

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

  // The graph is read from the same JSON the page offers for download, so what
  // it draws is what a reader would get if they took it away.
  it('draws the nodes of the template it downloads', async () => {
    servingGraph(async () => Response.json(graphJson()))

    render(WorkflowPreview, { props: { model, cloudHref } })

    expect(
      await screen.findByRole('img', { name: /nodes of this workflow/i })
    ).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(model.workflow.template?.downloadUrl)
  })

  // The flat export is what this page showed before, so it is what a graph
  // that cannot be read falls back to.
  it('falls back to the flat export when the template cannot be read', async () => {
    servingGraph(async () => Response.error())

    render(WorkflowPreview, { props: { model, cloudHref } })

    await waitFor(() =>
      expect(
        screen.getByTestId('workflow-graph-flat').getAttribute('src')
      ).toBe(model.workflow.template?.previewUrl)
    )
  })
})
