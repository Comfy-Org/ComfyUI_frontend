import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { h } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import PanelSearchHeader from './PanelSearchHeader.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { searchPlaceholder: 'Search', clear: 'Clear' } } }
})

function renderHeader(
  searcher: (
    query: string,
    onCleanup: (fn: () => void) => void
  ) => Promise<void>
) {
  return render(PanelSearchHeader, {
    props: { searcher, updateKey: [], modelValue: '' },
    slots: { default: () => h('button', { 'data-testid': 'slot' }, 'toggle') },
    global: { plugins: [i18n] }
  })
}

describe('PanelSearchHeader', () => {
  it('forwards the searcher to the embedded search input', async () => {
    const searcher = vi.fn().mockResolvedValue(undefined)
    renderHeader(searcher)

    await waitFor(() =>
      expect(searcher).toHaveBeenCalledWith('', expect.any(Function))
    )
  })

  it('renders default slot content alongside the search input', () => {
    renderHeader(vi.fn().mockResolvedValue(undefined))

    expect(screen.getByTestId('slot')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('emits query updates from the search input through v-model', async () => {
    const { emitted } = renderHeader(vi.fn().mockResolvedValue(undefined))

    await fireEvent.update(screen.getByRole('textbox'), 'seed')

    expect(emitted()['update:modelValue']).toContainEqual(['seed'])
  })

  it('re-fires the searcher when updateKey changes', async () => {
    const searcher = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHeader(searcher)

    await waitFor(() => expect(searcher).toHaveBeenCalledTimes(1))

    await rerender({ updateKey: ['changed'] })

    await waitFor(() => expect(searcher).toHaveBeenCalledTimes(2))
  })
})
