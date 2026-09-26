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

  // The eyebrow's two halves are independent: the category reads its English
  // label where there is one and the raw category where there is not, and the
  // shelf link stands whether or not a category sits beside it.
  it.for([
    {
      category: 'Utilities',
      categoryLabel: { en: 'Clean-up', 'zh-CN': '清理' },
      reads: 'Clean-up'
    },
    { category: 'Utilities', categoryLabel: undefined, reads: 'Utilities' },
    { category: undefined, categoryLabel: undefined, reads: undefined }
  ] as const)('reads the category as $reads', ({ reads, ...category }) => {
    render(WorkflowPage, { props: { model: { ...model, ...category } } })

    if (reads) expect(screen.getByText(reads)).toBeTruthy()
    else expect(screen.queryByText('Utilities')).toBeNull()
    expect(screen.getByTestId('workflow-use-case')).toBeTruthy()
  })
})
