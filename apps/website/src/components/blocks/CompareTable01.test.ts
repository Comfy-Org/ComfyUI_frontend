import { render, screen } from '@testing-library/vue'
import { h } from 'vue'
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

  it('lets slots replace the subtitle, headers and cells, and add a footer', () => {
    render(CompareTable01, {
      props: requiredProps,
      slots: {
        subtitle: () => h('em', 'Rich subtitle'),
        feature: ({ row }: { row: { feature: string } }) =>
          h('a', { href: '#' }, row.feature),
        cell: ({ cell, index }: { cell: string; index: number }) =>
          h('span', `${index}:${cell}`),
        column: ({ column }: { column: string }) =>
          h('img', { alt: column, src: '/logo.svg' }),
        footer: () => h('p', 'Footer note')
      }
    })

    expect(screen.getByText('Rich subtitle').tagName).toBe('EM')
    expect(screen.getByRole('link', { name: 'Team sharing' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: '1:Enterprise only' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'BUILDER' })).toBeTruthy()
    expect(screen.getByText('Footer note')).toBeTruthy()
  })
})
