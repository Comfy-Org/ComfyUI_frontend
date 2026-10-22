import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import PageHeader from './PageHeader.vue'

describe('admin page header', () => {
  it('keeps phase instructions and actions with a single title', () => {
    render(PageHeader, {
      props: {
        title: 'Draft changes',
        description: 'Review before publishing'
      },
      slots: {
        default: '<p>Phase 1: decide all items</p>',
        actions: '<button>Next</button>',
        eyebrow: '<p>Draft 6</p>'
      }
    })
    expect(
      screen.getByRole('heading', { level: 1, name: 'Draft changes' })
    ).toBeVisible()
    expect(screen.getByText('Phase 1: decide all items')).toBeVisible()
    expect(screen.getByText('Draft 6')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next' })).toBeVisible()
  })
  it('does not add empty description text', () => {
    render(PageHeader, {
      props: { title: 'Draft changes', description: ' \n ' }
    })
    expect(screen.getByRole('heading')).toHaveTextContent('Draft changes')
    expect(screen.queryByText('Review before publishing')).toBeNull()
  })
})
