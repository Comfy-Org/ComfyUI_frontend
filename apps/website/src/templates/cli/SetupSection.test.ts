import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  captureCliConnectionTabClick,
  captureCliClientTabClick
} from '../../scripts/posthog'
import SetupSection from './SetupSection.vue'

vi.mock(import('../../scripts/posthog'))

// reka-ui tab triggers activate on the pointer sequence, not a bare synthetic
// click, so drive them through userEvent.
async function selectTab(name: RegExp | string) {
  await userEvent.click(screen.getByRole('tab', { name }))
}

// Switching connections swaps which panel's client tabs are mounted, and the
// replacement lands one tick after the click settles.
async function selectConnection(name: RegExp) {
  await selectTab(name)
  await nextTick()
}

describe('SetupSection', () => {
  it('renders the connection tabs and a client tab list', () => {
    render(SetupSection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('tablist', { name: 'Pick where it runs' })
    ).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Comfy Cloud/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Local ComfyUI/ })).toBeTruthy()

    expect(
      screen.getByRole('tablist', { name: 'Pick your client' })
    ).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Claude Code' })).toBeTruthy()
  })

  it('captures a connection tab click once per selection', async () => {
    render(SetupSection, { props: { locale: 'en' } })

    await selectConnection(/Local ComfyUI/)
    expect(captureCliConnectionTabClick).toHaveBeenCalledTimes(1)
    expect(captureCliConnectionTabClick).toHaveBeenCalledWith('local')

    await selectConnection(/Local ComfyUI/)
    expect(captureCliConnectionTabClick).toHaveBeenCalledTimes(1)
  })

  it('dedupes client tab captures per connection, not globally', async () => {
    render(SetupSection, { props: { locale: 'en' } })

    await selectTab('Codex')
    expect(captureCliClientTabClick).toHaveBeenCalledTimes(1)
    expect(captureCliClientTabClick).toHaveBeenCalledWith('codex')

    await selectTab('Codex')
    expect(captureCliClientTabClick).toHaveBeenCalledTimes(1)

    // The same client under the other connection is a distinct selection.
    await selectConnection(/Local ComfyUI/)
    await selectTab('Codex')
    expect(captureCliClientTabClick).toHaveBeenCalledTimes(2)
    expect(captureCliClientTabClick).toHaveBeenLastCalledWith('codex')

    await selectTab('Codex')
    expect(captureCliClientTabClick).toHaveBeenCalledTimes(2)
  })
})
