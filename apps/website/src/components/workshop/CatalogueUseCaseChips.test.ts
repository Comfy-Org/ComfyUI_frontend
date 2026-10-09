import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import CatalogueUseCaseChips from './CatalogueUseCaseChips.vue'

const OPTIONS = [
  { value: 'generate', label: 'Generate', count: 4 },
  { value: 'edit', label: 'Edit', count: 2 }
]

function mountChips(options = OPTIONS) {
  const selected = ref<string[]>([])
  render(
    defineComponent({
      setup: () => () =>
        h(CatalogueUseCaseChips<string>, {
          label: 'Use cases',
          options,
          modelValue: selected.value,
          'onUpdate:modelValue': (value: string[]) => {
            selected.value = value
          }
        })
    })
  )
  return { selected }
}

describe('CatalogueUseCaseChips', () => {
  it('names the group and shows each option with its count after All', () => {
    mountChips()

    const group = screen.getByRole('group', { name: 'Use cases' })
    expect(
      within(group)
        .getAllByRole('button')
        .map((chip) => chip.textContent.replace(/\s+/g, ' ').trim())
    ).toEqual(['All', 'Generate 4', 'Edit 2'])
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('toggles several options and lets All clear them', async () => {
    const user = userEvent.setup()
    const { selected } = mountChips()

    await user.click(screen.getByRole('button', { name: 'Generate 4' }))
    await user.click(screen.getByRole('button', { name: 'Edit 2' }))
    expect(selected.value).toEqual(['generate', 'edit'])
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )

    await user.click(screen.getByRole('button', { name: 'Generate 4' }))
    expect(selected.value).toEqual(['edit'])
    expect(screen.getByRole('button', { name: 'Edit 2' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(selected.value).toEqual([])
  })

  it('renders nothing when there is nothing to choose', () => {
    mountChips([])
    expect(screen.queryByRole('group')).toBeNull()
  })
})
