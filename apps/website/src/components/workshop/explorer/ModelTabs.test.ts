import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type { ModelTabCounts } from '@/lib/workshop/explorer/model-tab-counts'
import type { ModelTab } from '@/lib/workshop/explorer/model-tabs'
import { MODEL_TABS } from '@/lib/workshop/explorer/model-tabs'
import ModelTabs from './ModelTabs.vue'

const happyWindow = window as typeof window & {
  happyDOM: { setViewport: (viewport: { width: number }) => void }
}

const EVERY_TAB_LISTS: ModelTabCounts = new Map(
  MODEL_TABS.map((tab, index): [ModelTab, number] => [tab, index + 1])
)

function renderTabs(
  initial: ModelTab = 'all',
  counts: ModelTabCounts = EVERY_TAB_LISTS
) {
  const selected = ref<ModelTab>(initial)
  render(
    defineComponent({
      setup: () => () =>
        h(ModelTabs, {
          modelValue: selected.value,
          panelId: 'panel',
          counts,
          'onUpdate:modelValue': (value: ModelTab) => {
            selected.value = value
          }
        })
    })
  )
  return selected
}

function tabNames() {
  return screen.getAllByRole('tab').map((tab) => tab.getAttribute('data-tab'))
}

afterEach(() => happyWindow.happyDOM.setViewport({ width: 1024 }))

describe('ModelTabs', () => {
  it('offers every category as a tab on one list, with Task and Access headed and the types first', () => {
    renderTabs()
    const list = screen.getByRole('tablist', { name: 'Model categories' })
    expect(list).toHaveAttribute('aria-orientation', 'vertical')
    expect(tabNames()).toEqual([
      'all',
      'image',
      'video',
      'audio',
      '3d',
      'llm',
      'edit',
      'upscale',
      'open',
      'partner'
    ])
    expect(screen.getByRole('tab', { name: 'Partner nodes' })).toBeTruthy()
    expect(
      ['Task', 'Access'].map((title) => screen.getByText(title))
    ).toHaveLength(2)
    expect(screen.queryByText('Type')).toBeNull()
    for (const tab of screen.getAllByRole('tab')) {
      expect(list).toContainElement(tab)
      expect(tab).toHaveAttribute('aria-controls', 'panel')
    }
  })

  it('shows how many models each category lists', () => {
    renderTabs()
    expect(screen.getByRole('tab', { name: 'Video' })).toHaveTextContent(
      'Video3'
    )
  })

  it('hides a category that lists nothing, and a group left with none', () => {
    renderTabs(
      'all',
      new Map<ModelTab, number>([
        ...EVERY_TAB_LISTS,
        ['llm', 0],
        ['edit', 0],
        ['upscale', 0]
      ])
    )
    expect(tabNames()).toEqual([
      'all',
      'image',
      'video',
      'audio',
      '3d',
      'open',
      'partner'
    ])
    expect(screen.queryByText('Task')).toBeNull()
  })

  it('marks the chosen tab and keeps only it in the tab order', () => {
    renderTabs('open')
    const open = screen.getByRole('tab', { name: 'Open weights' })
    expect(open).toHaveAttribute('aria-selected', 'true')
    expect(open).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'false'
    )
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'tabindex',
      '-1'
    )
  })

  it('chooses a tab on click', async () => {
    const selected = renderTabs()
    await userEvent.click(screen.getByRole('tab', { name: 'Video' }))
    expect(selected.value).toBe('video')
  })

  it('moves down the sidebar with Up, Down, Home and End, wrapping at the ends', async () => {
    const selected = renderTabs()
    const user = userEvent.setup()
    screen.getByRole('tab', { name: 'All' }).focus()

    await user.keyboard('{ArrowDown}')
    expect(selected.value).toBe('image')
    expect(screen.getByRole('tab', { name: 'Image' })).toHaveFocus()

    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(selected.value).toBe('partner')

    await user.keyboard('{Home}')
    expect(selected.value).toBe('all')
    await user.keyboard('{End}')
    expect(selected.value).toBe('partner')
    expect(screen.getByRole('tab', { name: 'Partner nodes' })).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(selected.value).toBe('partner')
  })

  it('moves along the phone chip row with Left and Right', async () => {
    happyWindow.happyDOM.setViewport({ width: 390 })
    const selected = renderTabs()
    const user = userEvent.setup()
    expect(screen.getByRole('tablist')).toHaveAttribute(
      'aria-orientation',
      'horizontal'
    )
    screen.getByRole('tab', { name: 'All' }).focus()

    await user.keyboard('{ArrowRight}')
    expect(selected.value).toBe('image')
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(selected.value).toBe('partner')
  })
})
