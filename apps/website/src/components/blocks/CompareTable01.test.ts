// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import CompareTable01 from './CompareTable01.vue'

type CompareTableProps = ComponentProps<typeof CompareTable01>

const requiredProps = {
  heading: 'Builder vs. Managed Builds',
  columns: ['BUILDER', 'MANAGED BUILDS'],
  rows: [
    {
      id: 'packaging',
      feature: 'Custom nodes packaging',
      cells: ['Included', 'Included']
    },
    {
      id: 'sharing',
      feature: 'Team sharing',
      cells: ['Not included', 'Enterprise only']
    }
  ]
} satisfies CompareTableProps

function renderCompareTable(props: Partial<CompareTableProps> = {}) {
  return render(CompareTable01, {
    props: { ...requiredProps, ...props }
  })
}

describe('CompareTable01', () => {
  it('renders a semantic table with scoped column and row headers', () => {
    renderCompareTable()

    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'FEATURE' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'BUILDER' })).toBeTruthy()
    expect(
      screen.getByRole('columnheader', { name: 'MANAGED BUILDS' })
    ).toBeTruthy()
    expect(
      screen.getByRole('rowheader', { name: 'Custom nodes packaging' })
    ).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'Team sharing' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Enterprise only' })).toBeTruthy()
    expect(screen.getAllByRole('cell', { name: 'Included' })).toHaveLength(2)
  })

  it('renders the heading and omits the subtitle by default', () => {
    renderCompareTable()

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Builder vs. Managed Builds'
      })
    ).toBeTruthy()
    expect(screen.queryByText(/self-serve/)).toBeNull()
  })

  it('renders the subtitle when provided', () => {
    renderCompareTable({
      subtitle:
        'Builder is self-serve for packaging and testing your own environment.'
    })

    expect(
      screen.getByText(
        'Builder is self-serve for packaging and testing your own environment.'
      )
    ).toBeTruthy()
  })
})
