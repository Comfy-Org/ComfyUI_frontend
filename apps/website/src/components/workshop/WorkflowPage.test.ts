import { render, screen } from '@testing-library/vue'
import { assert, describe, expect, it } from 'vitest'

import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import WorkflowPage from './WorkflowPage.vue'

const model = workflowDetailsBySlug.get('workflows/remove-background')
assert(model)

// Who made the workflow stands over its name, and the shelf it sits on is the
// one thing up there that leads somewhere.
describe('WorkflowPage header', () => {
  it('sends the shelf it names to that shelf, filtered', () => {
    render(WorkflowPage, { props: { model } })

    const shelf = screen.getByTestId('workflow-use-case')
    expect(shelf.textContent.trim()).toBe('Edit images')
    expect(shelf.getAttribute('href')).toBe('/models?useCase=edit-images')
  })

  it('says nothing about a shelf a workflow has none of', () => {
    render(WorkflowPage, {
      props: {
        model: {
          ...model,
          useCases: [],
          task: undefined,
          modality: undefined
        }
      }
    })

    expect(screen.queryByTestId('workflow-use-case')).toBeNull()
  })

  it.for([
    { author: 'ComfyUI', authors: 1 },
    { author: undefined, authors: 0 }
  ] as const)('names $authors author(s)', ({ author, authors }) => {
    render(WorkflowPage, { props: { model: { ...model, author } } })

    const named = screen.queryAllByTestId('workflow-author')
    expect(named).toHaveLength(authors)
    if (author) expect(named[0]).toHaveTextContent(author)
    expect(screen.getByTestId('workflow-use-case')).toBeTruthy()
  })
})
