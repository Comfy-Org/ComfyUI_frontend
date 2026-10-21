import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SelectOption } from '@/components/ui/select/types'
import en from '@/locales/en/main.json'

import AppMultiSelect from './AppMultiSelect.vue'
import AppSingleSelect from './AppSingleSelect.vue'

const options = [
  { name: 'Alpha', value: 'a' },
  { name: 'Beta', value: 'b' }
]

function createTranslations() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: { g: en.g },
      fr: {
        g: {
          search: 'Rechercher',
          noResultsFound: 'Aucun résultat',
          clearAll: 'Tout effacer',
          itemsSelected: 'Aucun choix | {count} choix | {count} choix',
          singleSelectDropdown: 'Choix unique',
          multiSelectDropdown: 'Choix multiples'
        }
      }
    }
  })
}

describe('App select labels', () => {
  it.for([
    {
      label: undefined,
      accessibleLabel: undefined,
      single: 'Single-select dropdown',
      multi: 'Multi-select dropdown'
    },
    {
      label: '',
      accessibleLabel: undefined,
      single: 'Single-select dropdown',
      multi: 'Multi-select dropdown'
    },
    {
      label: 'Choose',
      accessibleLabel: undefined,
      single: 'Choose',
      multi: 'Choose'
    },
    {
      label: 'Choose',
      accessibleLabel: 'Custom label',
      single: 'Custom label',
      multi: 'Custom label'
    }
  ])(
    'uses the accessible name $single / $multi',
    ({ label, accessibleLabel, single, multi }) => {
      const i18n = createTranslations()
      render(AppSingleSelect, {
        props: { modelValue: undefined, label, accessibleLabel },
        global: { plugins: [i18n] }
      })
      render(AppMultiSelect, {
        props: { modelValue: [], label, accessibleLabel },
        global: { plugins: [i18n] }
      })

      expect(screen.getByRole('combobox', { name: single })).toBeVisible()
      expect(screen.getByRole('button', { name: multi })).toBeVisible()
    }
  )
})

describe('AppSingleSelect', () => {
  it('updates translated search and empty text when the locale changes', async () => {
    const user = userEvent.setup()
    const i18n = createTranslations()
    render(AppSingleSelect, {
      props: { modelValue: undefined, searchable: true },
      global: { plugins: [i18n] }
    })

    await user.click(
      screen.getByRole('button', { name: 'Single-select dropdown' })
    )
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveAttribute(
      'placeholder',
      'Search'
    )
    expect(screen.getByText('No Results Found')).toBeVisible()

    i18n.global.locale.value = 'fr'
    await nextTick()

    expect(screen.getByRole('button', { name: 'Choix unique' })).toBeVisible()
    expect(
      screen.getByRole('combobox', { name: 'Rechercher' })
    ).toHaveAttribute('placeholder', 'Rechercher')
    expect(screen.getByText('Aucun résultat')).toBeVisible()
  })

  it('keeps the selected model synchronized and forwards the icon slot', async () => {
    const user = userEvent.setup()
    const selected = ref<string | number | undefined>('a')
    render(
      {
        components: { AppSingleSelect },
        setup: () => ({ selected, options }),
        template:
          '<AppSingleSelect v-model="selected" :options="options" searchable label="Choose"><template #icon><span>Icon</span></template></AppSingleSelect>'
      },
      { global: { plugins: [createTranslations()] } }
    )

    expect(screen.getByRole('button', { name: 'Choose' })).toHaveTextContent(
      'Alpha'
    )
    expect(screen.getByText('Icon')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Choose' }))
    await user.click(screen.getByRole('option', { name: 'Beta' }))

    expect(selected.value).toBe('b')
    expect(screen.getByRole('button', { name: 'Choose' })).toHaveTextContent(
      'Beta'
    )
    selected.value = 'a'
    await nextTick()
    expect(screen.getByRole('button', { name: 'Choose' })).toHaveTextContent(
      'Alpha'
    )
  })
})

describe('AppMultiSelect', () => {
  it('updates translated text and plural counts when the locale changes', async () => {
    const user = userEvent.setup()
    const i18n = createTranslations()
    render(AppMultiSelect, {
      props: {
        modelValue: [options[0]],
        showSearchBox: true,
        showSelectedCount: true,
        showClearButton: true
      },
      global: { plugins: [i18n] }
    })

    await user.click(
      screen.getByRole('button', { name: 'Multi-select dropdown' })
    )
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveAttribute(
      'placeholder',
      'Search'
    )
    expect(screen.getByText('1 item selected')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeVisible()
    expect(screen.getByText('No Results Found')).toBeVisible()

    i18n.global.locale.value = 'fr'
    await nextTick()

    expect(
      screen.getByRole('button', { name: 'Choix multiples' })
    ).toBeVisible()
    expect(
      screen.getByRole('combobox', { name: 'Rechercher' })
    ).toHaveAttribute('placeholder', 'Rechercher')
    expect(screen.getByText('1 choix')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Tout effacer' })).toBeVisible()
    expect(screen.getByText('Aucun résultat')).toBeVisible()
  })

  it('synchronizes selection, clearing and the secondary search model with the value slot', async () => {
    const user = userEvent.setup()
    const selected = ref<SelectOption[]>([options[0]])
    const query = ref('Bet')
    render(
      {
        components: { AppMultiSelect },
        setup: () => ({ selected, query, options }),
        template:
          '<AppMultiSelect v-model="selected" v-model:search-query="query" :options="options" show-search-box show-clear-button show-selected-count label="Choose"><template #value="{ selected: items }"><span>{{ items.map(item => item.name).join(" + ") }}</span></template></AppMultiSelect>'
      },
      { global: { plugins: [createTranslations()] } }
    )

    expect(screen.getByRole('button', { name: 'Choose' })).toHaveTextContent(
      'Alpha'
    )
    await user.click(screen.getByRole('button', { name: 'Choose' }))
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveValue('Bet')
    await user.click(screen.getByRole('option', { name: 'Beta' }))
    expect(selected.value).toEqual(options)
    expect(screen.getByText('2 items selected')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose' })).toHaveTextContent(
      'Alpha + Beta'
    )

    await user.clear(screen.getByRole('combobox', { name: 'Search' }))
    await user.type(screen.getByRole('combobox', { name: 'Search' }), 'Al')
    expect(query.value).toBe('Al')
    query.value = 'Bet'
    await nextTick()
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveValue('Bet')
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(selected.value).toEqual([])
    expect(screen.getByText('No items selected')).toBeVisible()
  })
})
