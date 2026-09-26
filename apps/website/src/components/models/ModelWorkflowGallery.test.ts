// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { CardWorkflowItem } from '../blocks/CardWorkflow01.vue'

import ModelWorkflowGallery from './ModelWorkflowGallery.vue'

const items: CardWorkflowItem[] = Array.from({ length: 9 }, (_, index) => ({
  id: `workflow-${index + 1}`,
  title: `Workflow ${index + 1}`,
  href: `/workflows/${index + 1}`,
  media: { type: 'placeholder', alt: '' }
}))

describe('ModelWorkflowGallery', () => {
  it('reveals workflows beyond the first eight on request', async () => {
    render(ModelWorkflowGallery, {
      props: {
        items,
        catalogHref: '/workflows',
        viewAllLabel: 'VIEW ALL WORKFLOWS',
        loadMoreLabel: 'LOAD MORE'
      }
    })

    expect(screen.queryByRole('link', { name: 'Workflow 9' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'LOAD MORE' }))

    expect(screen.getByRole('link', { name: 'Workflow 9' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'LOAD MORE' })).toBeNull()
  })

  it('places the complete catalog action after the workflow cards', () => {
    render(ModelWorkflowGallery, {
      props: {
        items: items.slice(0, 1),
        catalogHref: '/workflows',
        viewAllLabel: 'VIEW ALL WORKFLOWS',
        loadMoreLabel: 'LOAD MORE'
      }
    })

    expect(
      screen
        .getByRole('link', { name: 'VIEW ALL WORKFLOWS' })
        .getAttribute('href')
    ).toBe('/workflows')
    expect(screen.queryByRole('button', { name: 'LOAD MORE' })).toBeNull()
  })
})
