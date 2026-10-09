import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import messages from '@/locales/en/main.json'
import CommunityFacetSelect from './CommunityFacetSelect.vue'

it('keeps a large facet list bounded while making its last value searchable and selectable', async () => {
  const user = userEvent.setup()
  const result = render(CommunityFacetSelect, {
    props: {
      label: 'Models',
      modelValue: 'model-17',
      options: Array.from({ length: 5000 }, (_, index) => ({
        value: `model-${index}`,
        name: `Model ${index}`
      }))
    },
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
      ]
    }
  })
  await user.click(screen.getByRole('combobox', { name: 'Models' }))
  expect(screen.getByRole('combobox', { name: 'Search Models' })).toHaveValue(
    ''
  )
  expect(screen.getAllByRole('option').length).toBeLessThan(100)
  await user.type(
    screen.getByRole('combobox', { name: 'Search Models' }),
    'model 4999'
  )
  await user.click(await screen.findByRole('option', { name: 'Model 4999' }))
  expect(result.emitted()['update:modelValue']).toEqual([['model-4999']])
})
