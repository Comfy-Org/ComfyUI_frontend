import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import NodeSearchTypeFilterPopover from '@/components/searchbox/v2/NodeSearchTypeFilterPopover.vue'
import type { FilterChip } from '@/components/searchbox/v2/NodeSearchFilterBar.vue'
import { testI18n } from '@/components/searchbox/v2/__test__/testUtils'

function createMockChip(
  data: string[] = ['IMAGE', 'LATENT', 'MODEL']
): FilterChip {
  return {
    key: 'input',
    label: 'Input',
    filter: {
      id: 'input',
      matches: vi.fn(),
      fuseSearch: {
        search: vi.fn((query: string) =>
          data.filter((d) => d.toLowerCase().includes(query.toLowerCase()))
        ),
        data
      }
    } as unknown as FilterChip['filter']
  }
}

describe(NodeSearchTypeFilterPopover, () => {
  let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  function createWrapper(
    props: {
      chip?: FilterChip
      selectedValues?: string[]
    } = {}
  ) {
    wrapper = mount(NodeSearchTypeFilterPopover, {
      props: {
        chip: props.chip ?? createMockChip(),
        selectedValues: props.selectedValues ?? []
      },
      slots: {
        default: '<button data-testid="trigger">Input</button>'
      },
      global: {
        plugins: [testI18n]
      },
      attachTo: document.body
    })
    return wrapper
  }

  async function openPopover(w: ReturnType<typeof mount>) {
    await w.find('[data-testid="trigger"]').trigger('click')
    await nextTick()
    await nextTick()
  }

  function getOptions() {
    return wrapper.findAll('[role="option"]')
  }

  it('should render the trigger slot', () => {
    createWrapper()
    expect(wrapper.find('[data-testid="trigger"]').exists()).toBe(true)
  })

  it('should show popover content when trigger is clicked', async () => {
    createWrapper()
    await openPopover(wrapper)
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)
  })

  it('should display all options sorted alphabetically', async () => {
    createWrapper({ chip: createMockChip(['MODEL', 'IMAGE', 'LATENT']) })
    await openPopover(wrapper)

    const options = getOptions()
    expect(options).toHaveLength(3)
    const texts = options.map((o) => o.text().trim())
    expect(texts[0]).toContain('IMAGE')
    expect(texts[1]).toContain('LATENT')
    expect(texts[2]).toContain('MODEL')
  })

  it('should show selected count text', async () => {
    createWrapper({ selectedValues: ['IMAGE', 'LATENT'] })
    await openPopover(wrapper)

    expect(wrapper.text()).toContain('2 items selected')
  })

  it('should show clear all button only when values are selected', async () => {
    createWrapper({ selectedValues: [] })
    await openPopover(wrapper)

    const buttons = wrapper.findAll('button')
    const clearBtn = buttons.find((b) => b.text().includes('Clear all'))
    expect(clearBtn).toBeUndefined()
  })

  it('should show clear all button when values are selected', async () => {
    createWrapper({ selectedValues: ['IMAGE'] })
    await openPopover(wrapper)

    const buttons = wrapper.findAll('button')
    const clearBtn = buttons.find((b) => b.text().includes('Clear all'))
    expect(clearBtn).toBeTruthy()
  })

  it('should emit clear when clear all button is clicked', async () => {
    createWrapper({ selectedValues: ['IMAGE'] })
    await openPopover(wrapper)

    const clearBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Clear all'))!
    await clearBtn.trigger('click')
    await nextTick()

    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('should emit toggle when an option is clicked', async () => {
    createWrapper()
    await openPopover(wrapper)

    const options = getOptions()
    await options[0].trigger('click')
    await nextTick()

    expect(wrapper.emitted('toggle')).toBeTruthy()
    expect(wrapper.emitted('toggle')![0][0]).toBe('IMAGE')
  })

  it('should filter options via search input', async () => {
    createWrapper()
    await openPopover(wrapper)

    const searchInput = wrapper.find('input')
    await searchInput.setValue('IMAGE')
    await nextTick()

    const options = getOptions()
    expect(options).toHaveLength(1)
    expect(options[0].text()).toContain('IMAGE')
  })

  it('should show no results when search matches nothing', async () => {
    createWrapper()
    await openPopover(wrapper)

    const searchInput = wrapper.find('input')
    await searchInput.setValue('NONEXISTENT')
    await nextTick()

    expect(getOptions()).toHaveLength(0)
    expect(wrapper.text()).toContain('No results')
  })
})
