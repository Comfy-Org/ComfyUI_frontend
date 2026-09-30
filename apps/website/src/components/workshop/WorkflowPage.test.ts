import { render, screen } from '@testing-library/vue'
import { assert, describe, expect, it, vi } from 'vitest'

import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import WorkflowPage from './WorkflowPage.vue'

vi.mock(import('../../config/workshop-session-state'))

const model = workflowDetailsBySlug.get('workflows/remove-background')
assert(model, 'the catalogue no longer carries the fixture workflow')
const template = model.workflow.template
assert(template, 'the fixture workflow no longer carries a template')

const mount = (selected = model) =>
  render(WorkflowPage, {
    props: { model: selected },
    global: { stubs: { WorkflowPlayground: true } }
  })

describe('WorkflowPage header', () => {
  it('sends the shelf it names to that shelf, filtered', () => {
    mount()

    const shelf = screen.getByTestId('workflow-use-case')
    expect(shelf.textContent.trim()).toBe('Edit images')
    expect(shelf.getAttribute('href')).toBe(
      '/models?type=workflows&category=cleanup'
    )
  })

  it('says nothing about a shelf a workflow has none of', () => {
    mount({
      ...model,
      useCases: [],
      task: undefined,
      modality: undefined
    })

    expect(screen.queryByTestId('workflow-use-case')).toBeNull()
  })

  it('leaves the credit and the models to the Details tab', () => {
    mount()

    const hero = screen.getByTestId('workflow-hero')
    expect(hero).toHaveTextContent(model.name)
    expect(hero).not.toHaveTextContent(`Template by ${template.author}`)
    for (const name of template.models) expect(hero).not.toHaveTextContent(name)
  })
})
