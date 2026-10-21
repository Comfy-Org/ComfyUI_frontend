import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SearchAutocomplete from './SearchAutocomplete.vue'

function findContentElement(): HTMLElement | null {
  return document.querySelector('[data-dismissable-layer]')
}

describe('SearchAutocomplete z-index', () => {
  it('opens suggestions above a dialog already in the document', async () => {
    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })
    const dialog = screen.getByTestId('existing-overlay')

    const { rerender, unmount } = render(SearchAutocomplete, {
      container: document.body.appendChild(document.createElement('div')),
      props: {
        accessibleLabel: 'Search',
        clearLabel: 'Clear',
        modelValue: 'fo',
        suggestions: []
      }
    })

    await rerender({ suggestions: ['foo', 'foobar'] })

    const content = findContentElement()
    expect(content).not.toBeNull()
    expect(dialog.compareDocumentPosition(content!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )

    unmount()
  })

  it('keeps the static z-index class when no dialog is open', async () => {
    const { rerender, unmount } = render(SearchAutocomplete, {
      container: document.body.appendChild(document.createElement('div')),
      props: {
        accessibleLabel: 'Search',
        clearLabel: 'Clear',
        modelValue: 'fo',
        suggestions: []
      }
    })

    await rerender({ suggestions: ['foo', 'foobar'] })

    const content = findContentElement()
    expect(content).not.toBeNull()
    expect(content!.style.zIndex).toBe('')
    expect(content!.className).toContain('z-overlay')

    unmount()
  })
})
