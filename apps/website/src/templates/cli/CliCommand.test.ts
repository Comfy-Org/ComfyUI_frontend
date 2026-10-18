import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { expect, it } from 'vitest'

import CliCommand from './CliCommand.vue'

it('copies the complete multiline command without changing its text', async () => {
  const user = userEvent.setup()
  const value = 'comfy setup --where cloud\ncomfy skills install'
  render(CliCommand, {
    props: { value, copyLabel: 'Copy command', copiedLabel: 'Copied' }
  })

  await user.click(screen.getByRole('button', { name: 'Copy command' }))

  expect(await navigator.clipboard.readText()).toBe(value)
  expect(screen.getByText('Copied', { selector: '[aria-live]' })).toBeTruthy()
})
