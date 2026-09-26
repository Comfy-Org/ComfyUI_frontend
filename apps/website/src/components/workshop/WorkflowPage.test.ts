import { render, screen } from '@testing-library/vue'
import { assert, describe, expect, it } from 'vitest'

import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import WorkflowPage from './WorkflowPage.vue'

const model = workflowDetailsBySlug.get('workflows/remove-background')
assert(model)

// The eyebrow named the shelf this workflow sits on, and a word is not a way
// back. It is the one thing up there that can lead somewhere.
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
})
