import { ZIndex } from '@primeuix/utils/zindex'
import { render } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import SearchAutocomplete from './SearchAutocomplete.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { searchPlaceholder: 'Search...', clear: 'Clear' } } }
})

function findContentElement(): HTMLElement | null {
  return document.querySelector('[data-dismissable-layer]')
}

let openModal: HTMLElement | undefined

afterEach(() => {
  if (openModal) {
    ZIndex.clear(openModal)
    openModal = undefined
  }
})

describe('SearchAutocomplete z-index', () => {
  it('opens suggestions above a dialog registered with the modal z-index counter', async () => {
    openModal = document.createElement('div')
    ZIndex.set('modal', openModal, 3702)
    const dialogZIndex = Number(openModal.style.zIndex)

    const { rerender, unmount } = render(SearchAutocomplete, {
      container: document.body.appendChild(document.createElement('div')),
      props: { modelValue: 'fo', suggestions: [] },
      global: { plugins: [i18n] }
    })

    await rerender({ suggestions: ['foo', 'foobar'] })

    const content = findContentElement()
    expect(content).not.toBeNull()
    expect(Number(content!.style.zIndex)).toBeGreaterThan(dialogZIndex)

    unmount()
  })

  it('keeps the static z-index class when no dialog is open', async () => {
    const { rerender, unmount } = render(SearchAutocomplete, {
      container: document.body.appendChild(document.createElement('div')),
      props: { modelValue: 'fo', suggestions: [] },
      global: { plugins: [i18n] }
    })

    await rerender({ suggestions: ['foo', 'foobar'] })

    const content = findContentElement()
    expect(content).not.toBeNull()
    expect(content!.style.zIndex).toBe('')
    expect(content!.className).toContain('z-3000')

    unmount()
  })
})
