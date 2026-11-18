import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { publishedApi } from '@/platform/nodeApi/v4/__tests__/publishedApi'

import ActionBarButtons from './ActionBarButtons.vue'

describe('ActionBarButtons', () => {
  it('runs a node API button with the click that pressed it', async () => {
    const run = vi.fn()
    publishedApi().ui.addActionBarButton({
      id: 'MyPack.open',
      icon: 'icon-[lucide--camera]',
      tooltip: 'Open the panel',
      run
    })
    render(ActionBarButtons)

    await userEvent.click(
      screen.getByRole('button', { name: 'Open the panel' })
    )

    expect(run).toHaveBeenCalledExactlyOnceWith(expect.any(MouseEvent))
  })
})
