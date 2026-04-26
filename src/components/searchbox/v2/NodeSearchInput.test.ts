import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FilterChip } from '@/components/searchbox/v2/NodeSearchFilterBar.vue'
import NodeSearchInput from '@/components/searchbox/v2/NodeSearchInput.vue'
import {
  setupTestPinia,
  testI18n
} from '@/components/searchbox/v2/__test__/testUtils'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { FuseFilter, FuseFilterWithValue } from '@/utils/fuseUtil'

vi.mock('@/utils/litegraphUtil', () => ({
  getLinkTypeColor: vi.fn((type: string) =>
    type === 'IMAGE' ? '#64b5f6' : undefined
  )
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn()
  }))
}))

function createFilter(
  id: string,
  value: string
): FuseFilterWithValue<ComfyNodeDefImpl, string> {
  return {
    filterDef: {
      id,
      matches: vi.fn(() => true)
    } as Partial<FuseFilter<ComfyNodeDefImpl, string>> as FuseFilter<
      ComfyNodeDefImpl,
      string
    >,
    value
  }
}

function createActiveFilter(label: string): FilterChip {
  return {
    key: label.toLowerCase(),
    label,
    filter: {
      id: label.toLowerCase(),
      matches: vi.fn(() => true)
    } as Partial<FuseFilter<ComfyNodeDefImpl, string>> as FuseFilter<
      ComfyNodeDefImpl,
      string
    >
  }
}

describe('NodeSearchInput', () => {
  beforeEach(() => {
    setupTestPinia()
    vi.restoreAllMocks()
  })

  function createRender(
    props: Partial<{
      filters: FuseFilterWithValue<ComfyNodeDefImpl, string>[]
      activeFilter: FilterChip | null
      searchQuery: string
      filterQuery: string
    }> = {}
  ) {
    const user = userEvent.setup()
    const onUpdateSearchQuery = vi.fn()
    const onUpdateFilterQuery = vi.fn()
    const onCancelFilter = vi.fn()
    const onSelectCurrent = vi.fn()
    const onNavigateDown = vi.fn()
    const onNavigateUp = vi.fn()
    render(NodeSearchInput, {
      props: {
        filters: [],
        activeFilter: null,
        searchQuery: '',
        filterQuery: '',
        'onUpdate:searchQuery': onUpdateSearchQuery,
        'onUpdate:filterQuery': onUpdateFilterQuery,
        onCancelFilter,
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
      onUpdateFilterQuery,
      onCancelFilter,
      onSelectCurrent,
      onNavigateDown,
      onNavigateUp
    }
  }

  it('should route input to searchQuery when no active filter', async () => {
    const { user, onUpdateSearchQuery } = createRender()
    await user.type(screen.getByRole('combobox'), 'test search')

    expect(onUpdateSearchQuery).toHaveBeenLastCalledWith('test search')
  })

  it('should route input to filterQuery when active filter is set', async () => {
    const { user, onUpdateFilterQuery, onUpdateSearchQuery } = createRender({
      activeFilter: createActiveFilter('Input')
    })
    await user.type(screen.getByRole('combobox'), 'IMAGE')

    expect(onUpdateFilterQuery).toHaveBeenLastCalledWith('IMAGE')
    expect(onUpdateSearchQuery).not.toHaveBeenCalled()
  })

  it('should show filter label placeholder when active filter is set', () => {
    createRender({
      activeFilter: createActiveFilter('Input')
    })

    expect(screen.getByRole('combobox')).toHaveAttribute(
      'placeholder',
      expect.stringContaining('input')
    )
  })

  it('should show add node placeholder when no active filter', () => {
    createRender()

    expect(screen.getByRole('combobox')).toHaveAttribute(
      'placeholder',
      expect.stringContaining('Add a node')
    )
  })

  it('should hide filter chips when active filter is set', () => {
    createRender({
      filters: [createFilter('input', 'IMAGE')],
      activeFilter: createActiveFilter('Input')
    })

    expect(screen.queryAllByTestId('filter-chip')).toHaveLength(0)
  })

  it('should show filter chips when no active filter', () => {
    createRender({
      filters: [createFilter('input', 'IMAGE')]
    })

    expect(screen.getAllByTestId('filter-chip')).toHaveLength(1)
  })

  it('should emit cancelFilter when cancel button is clicked', async () => {
    const { user, onCancelFilter } = createRender({
      activeFilter: createActiveFilter('Input')
    })

    await user.click(screen.getByTestId('cancel-filter'))

    expect(onCancelFilter).toHaveBeenCalledOnce()
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
