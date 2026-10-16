import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import BuildTargetMenu from './BuildTargetMenu.vue'

describe('BuildTargetMenu', () => {
  it('keeps Local selected and offers a separate build action', async () => {
    const onDeploy = vi.fn()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(BuildTargetMenu, {
      props: { onDeploy },
      global: { plugins: [i18n] }
    })

    await user.click(
      screen.getByRole('button', { name: /choose where it runs/i })
    )

    expect(screen.getByRole('menuitemradio', { name: 'Local' })).toBeChecked()
    await user.click(screen.getByRole('menuitem', { name: 'Deploy to Cloud…' }))
    expect(onDeploy).toHaveBeenCalledOnce()
  })
})
