import { render, screen } from '@testing-library/vue'
import { assert, describe, expect, it } from 'vitest'

import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import WorkflowPreview from './WorkflowPreview.vue'

const model = workflowDetailsBySlug.get('workflows/animate-reference-sheet')
assert(model, 'the catalogue no longer carries the fixture workflow')
const template = model.workflow.template
assert(template, 'the fixture workflow no longer carries a template')

const cloudHref = 'https://cloud.example.com/?template=animate-reference-sheet'

describe('WorkflowPreview', () => {
  it('puts the graph beside the ways out and what it runs on', () => {
    render(WorkflowPreview, { props: { model, cloudHref } })

    const graph = screen.getByRole('img')
    expect(graph.getAttribute('src')).toBe(template.previewUrl)

    const actions = screen.getByTestId('workflow-actions')
    expect(actions).toContainElement(
      screen.getByRole('link', { name: 'Try in Cloud' })
    )
    expect(actions).toContainElement(
      screen.getByRole('link', { name: 'Download workflow JSON' })
    )

    const runsOn = screen.getByTestId('workflow-runs-on')
    expect(runsOn).toHaveTextContent('Runs on')
    for (const name of template.models) expect(runsOn).toHaveTextContent(name)
  })

  it('draws no graph and no facts when there is no template', () => {
    render(WorkflowPreview, {
      props: {
        model: {
          ...model,
          workflow: { ...model.workflow, template: undefined }
        }
      }
    })

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByTestId('workflow-runs-on')).toBeNull()
  })
})
