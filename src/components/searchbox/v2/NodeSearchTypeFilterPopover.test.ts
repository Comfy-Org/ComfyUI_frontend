import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  function createRender(
    props: {
      chip?: FilterChip
      selectedValues?: string[]
    } = {}
  ) {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const onClear = vi.fn()
    render(NodeSearchTypeFilterPopover, {
      props: {
        chip: props.chip ?? createMockChip(),
        selectedValues: props.selectedValues ?? [],
        onToggle,
        onClear
      },
      slots: {
        default: '<button data-testid="trigger">Input</button>'
      },
      global: { plugins: [testI18n] }
    })
    return { user, onToggle, onClear }
  }

  async function openPopover(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTestId('trigger'))
    await nextTick()
    await nextTick()
  }

  it('should render the trigger slot', () => {
    createRender()
    expect(screen.getByTestId('trigger')).toBeInTheDocument()
  })

  it('should show popover content when trigger is clicked', async () => {
    const { user } = createRender()
    await openPopover(user)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('should display all options sorted alphabetically', async () => {
    const { user } = createRender({
      chip: createMockChip(['MODEL', 'IMAGE', 'LATENT'])
    })
    await openPopover(user)

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    const texts = options.map((o) => o.textContent?.trim())
    expect(texts[0]).toContain('IMAGE')
    expect(texts[1]).toContain('LATENT')
    expect(texts[2]).toContain('MODEL')
  })

  it('should show selected count text', async () => {
    const { user } = createRender({ selectedValues: ['IMAGE', 'LATENT'] })
    await openPopover(user)

    expect(screen.getByText(/2 items selected/i)).toBeInTheDocument()
  })

  it('should show clear all button only when values are selected', async () => {
    const { user } = createRender({ selectedValues: [] })
    await openPopover(user)

    const buttons = screen.getAllByRole('button')
    const clearBtn = buttons.find((b) => b.textContent?.includes('Clear all'))
    expect(clearBtn).toBeUndefined()
  })

  it('should show clear all button when values are selected', async () => {
    const { user } = createRender({ selectedValues: ['IMAGE'] })
    await openPopover(user)

    expect(
      screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('Clear all'))
    ).toBeTruthy()
  })

  it('should emit clear when clear all button is clicked', async () => {
    const { user, onClear } = createRender({ selectedValues: ['IMAGE'] })
    await openPopover(user)

    const clearBtn = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('Clear all'))!
    await user.click(clearBtn)
    await nextTick()

    expect(onClear).toHaveBeenCalledOnce()
  })

  it('should emit toggle when an option is clicked', async () => {
    const { user, onToggle } = createRender()
    await openPopover(user)

    await user.click(screen.getAllByRole('option')[0])
    await nextTick()

    expect(onToggle).toHaveBeenCalledWith('IMAGE')
  })

  it('should filter options via search input', async () => {
    const { user } = createRender()
    await openPopover(user)

    await user.type(screen.getByRole('textbox'), 'IMAGE')
    await nextTick()

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0].textContent).toContain('IMAGE')
  })

  it('should show no results when search matches nothing', async () => {
    const { user } = createRender()
    await openPopover(user)

    await user.type(screen.getByRole('textbox'), 'NONEXISTENT')
    await nextTick()

    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('No results')).toBeInTheDocument()
  })
})
