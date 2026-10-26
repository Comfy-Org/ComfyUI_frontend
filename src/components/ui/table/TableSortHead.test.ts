import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import type { TableSortDirection } from './tableUtils'
import TableSortHead from './TableSortHead.vue'

function renderHead(initial: TableSortDirection | null) {
  const direction = ref(initial)
  render(
    defineComponent({
      components: { TableSortHead },
      setup: () => ({ direction }),
      template: `
        <table><thead><tr>
          <TableSortHead v-model:direction="direction">Name</TableSortHead>
        </tr></thead></table>
      `
    })
  )
  return direction
}

describe('TableSortHead', () => {
  it.for([
    { initial: null, sequence: ['none', 'ascending', 'descending'] },
    { initial: 'ascending', sequence: ['ascending', 'descending', 'ascending'] }
  ] as const)(
    'cycles aria-sort from $initial by click and keyboard',
    async ({ initial, sequence }) => {
      const user = userEvent.setup()
      const direction = renderHead(initial)
      const header = screen.getByRole('columnheader', { name: 'Name' })

      expect(header).toHaveAttribute('aria-sort', sequence[0])
      await user.click(screen.getByRole('button', { name: 'Name' }))
      expect(header).toHaveAttribute('aria-sort', sequence[1])
      await user.keyboard('{Enter}')
      expect(header).toHaveAttribute('aria-sort', sequence[2])
      expect(direction.value).toBe(sequence[2])
    }
  )
})
