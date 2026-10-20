import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import AppPagination from './AppPagination.vue'

it('translates navigation and preserves page and page-size updates', async () => {
  const user = userEvent.setup()
  const page = ref(3)
  const itemsPerPage = ref(25)
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: {
          itemsPerPage: 'Items per page',
          previous: 'Previous',
          next: 'Next',
          pageNumber: 'Page {page}'
        }
      },
      fr: {
        g: {
          itemsPerPage: 'Par page',
          previous: 'Précédent',
          next: 'Suivant',
          pageNumber: 'Page {page}'
        }
      }
    }
  })
  render(
    {
      components: { AppPagination },
      setup: () => ({ page, itemsPerPage }),
      template: `<AppPagination v-model:page="page" v-model:items-per-page="itemsPerPage" :total="240" :items-per-page-options="[25, 50, 100]" />`
    },
    { global: { plugins: [i18n] } }
  )

  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(page.value).toBe(4)

  i18n.global.locale.value = 'fr'
  await nextTick()
  expect(screen.getByRole('button', { name: 'Suivant' })).toBeVisible()
  await user.click(screen.getByRole('combobox', { name: 'Par page' }))
  await user.click(await screen.findByRole('option', { name: '100' }))
  expect(itemsPerPage.value).toBe(100)
  expect(page.value).toBe(1)
  expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled()
})
