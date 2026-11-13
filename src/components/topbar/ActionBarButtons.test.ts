import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { useComfyApiStore } from '@/platform/nodeApi/v4/comfyApiStore'

import ActionBarButtons from './ActionBarButtons.vue'

describe('ActionBarButtons', () => {
  it('runs a node API button with the click that pressed it', async () => {
    useComfyApiStore().publish()
    const run = vi.fn()
    window.comfy_v4?.ui.addActionBarButton({
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
