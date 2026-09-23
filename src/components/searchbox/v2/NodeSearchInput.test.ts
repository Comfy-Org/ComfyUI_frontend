import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { testI18n } from '@/components/searchbox/v2/__test__/testUtils'
import NodeSearchInput from '@/components/searchbox/v2/NodeSearchInput.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { FuseFilter, FuseFilterWithValue } from '@/utils/fuseUtil'

vi.mock<unknown>(import('@/utils/litegraphUtil'), () => ({
  getLinkTypeColor: vi.fn((type: string) =>
    type === 'IMAGE' ? '#64b5f6' : undefined
  )
}))

function createFilter(
  id: string,
  value: string
): FuseFilterWithValue<ComfyNodeDefImpl> {
  return {
    filterDef: {
      id,
      matches: vi.fn(() => true)
    } as Partial<FuseFilter<ComfyNodeDefImpl>> as FuseFilter<ComfyNodeDefImpl>,
    value
  }
}

describe('NodeSearchInput', () => {
  function createRender(
    props: Partial<{
      filters: FuseFilterWithValue<ComfyNodeDefImpl>[]
      searchQuery: string
    }> = {}
  ) {
    const user = userEvent.setup()
    const onUpdateSearchQuery = vi.fn()
    const onSelectCurrent = vi.fn()
    const onNavigateDown = vi.fn()
    const onNavigateUp = vi.fn()
    render(NodeSearchInput, {
      props: {
        filters: [],
        searchQuery: '',
        'onUpdate:searchQuery': onUpdateSearchQuery,
        onSelectCurrent,
        onNavigateDown,
        onNavigateUp,
        ...props
      },
      global: { plugins: [testI18n] }
    })
    return {
      user,
      onUpdateSearchQuery,
      onSelectCurrent,
      onNavigateDown,
      onNavigateUp
    }
  }

  it('should route input to searchQuery', async () => {
    const { user, onUpdateSearchQuery } = createRender()
    await user.type(screen.getByRole('combobox'), 'test search')

    expect(onUpdateSearchQuery).toHaveBeenLastCalledWith('test search')
  })

  it('should show add node placeholder', () => {
    createRender()

    expect(screen.getByRole('combobox')).toHaveAttribute(
      'placeholder',
      expect.stringContaining('Add a node')
    )
  })

  it('should show filter chips when filters are present', () => {
    createRender({
      filters: [createFilter('input', 'IMAGE')]
    })

    expect(screen.getAllByTestId('filter-chip')).toHaveLength(1)
  })

  it('should emit selectCurrent on Enter', async () => {
    const { user, onSelectCurrent } = createRender()

    await user.click(screen.getByRole('combobox'))
    await user.keyboard('{Enter}')

    expect(onSelectCurrent).toHaveBeenCalledOnce()
  })

  it('should emit navigateDown on ArrowDown', async () => {
    const { user, onNavigateDown } = createRender()

    await user.click(screen.getByRole('combobox'))
    await user.keyboard('{ArrowDown}')

    expect(onNavigateDown).toHaveBeenCalledOnce()
  })

  it('should emit navigateUp on ArrowUp', async () => {
    const { user, onNavigateUp } = createRender()

    await user.click(screen.getByRole('combobox'))
    await user.keyboard('{ArrowUp}')

    expect(onNavigateUp).toHaveBeenCalledOnce()
  })
})
