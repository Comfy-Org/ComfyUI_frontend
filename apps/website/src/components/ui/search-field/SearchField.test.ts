// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SearchField from './SearchField.vue'

const label = 'Search workflows, models, and creators'
const placeholder = 'Search workflows, models, creators...'

function renderSearchField() {
  return render(SearchField, { props: { label, placeholder } })
}

describe('SearchField', () => {
  it('accepts a search query through its accessible input', async () => {
    renderSearchField()
    const input = screen.getByRole('searchbox', { name: label })

    await userEvent.type(input, 'video')

    expect((input as HTMLInputElement).value).toBe('video')
  })

  it('focuses the search input with the website slash shortcut', async () => {
    renderSearchField()

    await userEvent.keyboard('/')

    expect(document.activeElement).toBe(
      screen.getByRole('searchbox', { name: label })
    )
  })
})
