import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { assert, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'
import { usePromptTagCatalogStore } from '@/platform/settings/promptTagCatalogStore'
import PromptTagCatalogPanel from './PromptTagCatalogPanel.vue'

function renderPanel() {
  return render(PromptTagCatalogPanel, { global: { plugins: [i18n] } })
}

describe('prompt tag catalog Settings', () => {
  it('discards an unfinished import when Settings closes', async () => {
    const user = userEvent.setup()
    let finish: ((text: string) => void) | undefined
    const pending = new Promise<string>((resolve) => (finish = resolve))
    const file = new File(['blue_eyes'], 'old.txt', { type: 'text/plain' })
    vi.spyOn(file, 'text').mockReturnValue(pending)
    const view = renderPanel()
    await user.upload(screen.getByLabelText('Import prompt tags'), file)
    view.unmount()
    renderPanel()
    await user.upload(
      screen.getByLabelText('Import prompt tags'),
      new File(['red_hair'], 'new.txt', { type: 'text/plain' })
    )
    expect(
      await screen.findByText('1 tag loaded for this session')
    ).toBeVisible()

    assert.exists(finish)
    finish('blue_eyes')
    await pending
    await nextTick()

    expect(usePromptTagCatalogStore().tags).toEqual(['red hair'])
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 tag loaded for this session'
    )
  })

  it('reports an invalid import without losing the loaded catalog', async () => {
    const user = userEvent.setup()
    usePromptTagCatalogStore().importCatalog('blue_eyes')
    renderPanel()

    await user.upload(
      screen.getByLabelText('Import prompt tags'),
      new File(['blue_hair,not-a-count'], 'invalid.csv', { type: 'text/csv' })
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your previous catalog is unchanged.'
    )
    expect(screen.getByText('1 tag loaded for this session')).toBeVisible()
  })
})
