import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import { testI18n } from '@/utils/__tests__/testI18n'

import Pagination from './Pagination.vue'

describe('Pagination', () => {
  it('returns to the first page when the page size changes', async () => {
    const user = userEvent.setup()
    const page = ref(1)
    const itemsPerPage = ref(25)
    render(
      defineComponent({
        components: { Pagination },
        setup: () => ({ page, itemsPerPage }),
        template: `<Pagination
          v-model:page="page"
          v-model:items-per-page="itemsPerPage"
          :total="240"
          :items-per-page-options="[25, 50, 100]"
        />`
      }),
      { global: { plugins: [testI18n] } }
    )

    await user.click(screen.getByRole('button', { name: 'Page 10' }))
    expect(page.value).toBe(10)

    await user.click(screen.getByRole('combobox', { name: 'Items per page' }))
    await user.click(await screen.findByRole('option', { name: '100' }))

    expect(itemsPerPage.value).toBe(100)
    expect(page.value).toBe(1)
  })
})
