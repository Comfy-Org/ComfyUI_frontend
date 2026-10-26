import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'

import Menu from './Menu.vue'
import { usePointMenu } from './usePointMenu'

it('opens an imperative menu, dismisses on a stopped outside press, and toggles without reopening', async () => {
  const command = vi.fn()
  render({
    components: { Menu },
    setup: () => ({ ...usePointMenu(), items: [{ label: 'Run', command }] }),
    template: `
      <button @click="toggle">Actions</button>
      <button @pointerdown.stop>Outside</button>
      <Menu v-bind="menuProps" :items="items" />
    `
  })
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: 'Actions' })

  await user.click(trigger)
  expect(await screen.findByRole('menuitem', { name: 'Run' })).toBeVisible()
  await user.click(trigger)
  await waitFor(() =>
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  )

  await user.click(trigger)
  expect(await screen.findByRole('menuitem', { name: 'Run' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Outside' }))
  await waitFor(() =>
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  )

  await user.click(trigger)
  await user.click(await screen.findByRole('menuitem', { name: 'Run' }))
  expect(command).toHaveBeenCalledOnce()
  await waitFor(() =>
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  )
})
