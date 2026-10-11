import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import { i18n } from '@/i18n'

import FilterDropdown from './FilterDropdown.vue'

describe('FilterDropdown', () => {
  it.for([
    {
      initial: { Image: true, Video: true },
      choice: 'Image',
      expected: { Image: true, Video: false }
    },
    {
      initial: { Image: true, Video: false },
      choice: 'Video',
      expected: { Image: true, Video: true }
    },
    {
      initial: { Image: true, Video: false },
      choice: 'Image',
      expected: { Image: true, Video: true }
    },
    {
      initial: { Image: false, Video: true },
      choice: 'All',
      expected: { Image: true, Video: true }
    }
  ])(
    'selects $choice from $initial without dismissing',
    async ({ initial, choice, expected }) => {
      const filters = ref(initial)
      render(
        defineComponent({
          components: { FilterDropdown },
          setup: () => ({ filters }),
          template: '<FilterDropdown v-model="filters" />'
        }),
        { global: { plugins: [i18n], directives: { tooltip: {} } } }
      )
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Filter' }))
      await user.click(screen.getByRole('menuitemcheckbox', { name: choice }))
      expect(filters.value).toEqual(expected)
      expect(screen.getByRole('menu')).toBeVisible()
    }
  )
})
