import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import MediaAssetSelectionBar from '@/platform/assets/components/MediaAssetSelectionBar.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      mediaAsset: {
        selection: {
          deselectAll: 'Deselect all',
          downloadSelected: 'Download',
          deleteSelected: 'Delete',
          selectedCount: '{count} selected'
        }
      }
    }
  }
})

function renderBar(
  props: { count: number; showDelete?: boolean } = { count: 2 }
) {
  return render(MediaAssetSelectionBar, {
    props,
    global: { plugins: [i18n], directives: { tooltip: {} } }
  })
}

describe('MediaAssetSelectionBar', () => {
  it('renders the selected count label', () => {
    renderBar({ count: 3 })
    expect(screen.getByText('3 selected')).toBeInTheDocument()
  })

  it('emits deselect when the close button is clicked', async () => {
    const { emitted } = renderBar({ count: 2 })
    await userEvent.click(screen.getByRole('button', { name: 'Deselect all' }))
    expect(emitted().deselect).toHaveLength(1)
  })

  it('emits download when the download button is clicked', async () => {
    const { emitted } = renderBar({ count: 2 })
    await userEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(emitted().download).toHaveLength(1)
  })

  it('emits delete when the delete button is clicked', async () => {
    const { emitted } = renderBar({ count: 2 })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(emitted().delete).toHaveLength(1)
  })

  it('hides the delete button when showDelete is false', () => {
    renderBar({ count: 2, showDelete: false })
    expect(
      screen.queryByRole('button', { name: 'Delete' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
  })
})
