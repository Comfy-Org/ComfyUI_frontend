import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    get: vi.fn((key: string) => {
      if (key === 'Comfy.NodeLibrary.Bookmarks.V2') return []
      if (key === 'Comfy.NodeLibrary.BookmarksCustomization') return {}
      return undefined
    }),
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

describe('NodeSearchInput', () => {
  beforeEach(() => {
    setupTestPinia()
    vi.restoreAllMocks()
  })

  function createWrapper(
    props: Partial<{
      filters: FuseFilterWithValue<ComfyNodeDefImpl, string>[]
      searchQuery: string
    }> = {}
  ) {
    return mount(NodeSearchInput, {
      props: {
        filters: [],
        searchQuery: '',
        ...props
      },
      global: { plugins: [testI18n] }
    })
  }

  it('should route input to searchQuery', async () => {
    const wrapper = createWrapper()
    await wrapper.find('input').setValue('test search')

    expect(wrapper.emitted('update:searchQuery')![0]).toEqual(['test search'])
  })

  it('should show add node placeholder', () => {
    const wrapper = createWrapper()

    expect(
      (wrapper.find('input').element as HTMLInputElement).placeholder
    ).toContain('Add a node')
  })

  it('should show filter chips when filters are present', () => {
    const wrapper = createWrapper({
      filters: [createFilter('input', 'IMAGE')]
    })

    expect(wrapper.findAll('[data-testid="filter-chip"]')).toHaveLength(1)
  })

  it('should emit selectCurrent on Enter', async () => {
    const wrapper = createWrapper()

    await wrapper.find('input').trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('selectCurrent')).toHaveLength(1)
  })

  it('should emit navigateDown on ArrowDown', async () => {
    const wrapper = createWrapper()

    await wrapper.find('input').trigger('keydown', { key: 'ArrowDown' })

    expect(wrapper.emitted('navigateDown')).toHaveLength(1)
  })

  it('should emit navigateUp on ArrowUp', async () => {
    const wrapper = createWrapper()

    await wrapper.find('input').trigger('keydown', { key: 'ArrowUp' })

    expect(wrapper.emitted('navigateUp')).toHaveLength(1)
  })
})
