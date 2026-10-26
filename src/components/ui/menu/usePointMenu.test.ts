import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, expect, it, vi } from 'vitest'

import Menu from './Menu.vue'
import { usePointMenu } from './usePointMenu'

const command = vi.fn()

beforeEach(() => {
  render({
    components: { Menu },
    setup: () => ({ ...usePointMenu(), items: [{ label: 'Run', command }] }),
    template: `
      <button @click="toggle">Actions</button>
      <button @pointerdown.stop>Outside</button>
      <Menu v-bind="menuProps" :items="items" />
    `
  })
})

it('toggles an open menu closed without reopening it', async () => {
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: 'Actions' })

  await user.click(trigger)
  expect(await screen.findByRole('menuitem', { name: 'Run' })).toBeVisible()
  await user.click(trigger)
  await waitFor(() =>
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  )
})

it('dismisses on an outside press with stopped propagation', async () => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Actions' }))
  expect(await screen.findByRole('menuitem', { name: 'Run' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Outside' }))
  await waitFor(() =>
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  )
})

it('runs the selected command and closes the menu', async () => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Actions' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Run' }))
  expect(command).toHaveBeenCalledOnce()
  await waitFor(() =>
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  )
})
