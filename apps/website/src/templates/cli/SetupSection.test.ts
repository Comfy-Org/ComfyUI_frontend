// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import SetupSection from './SetupSection.vue'

const { connectionSpy, clientSpy } = vi.hoisted(() => ({
  connectionSpy: vi.fn(),
  clientSpy: vi.fn()
}))

vi.mock('../../scripts/posthog', () => ({
  captureCliConnectionTabClick: connectionSpy,
  captureCliClientTabClick: clientSpy
}))

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
  beforeEach(() => {
    connectionSpy.mockClear()
    clientSpy.mockClear()
  })

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
    expect(connectionSpy).toHaveBeenCalledTimes(1)
    expect(connectionSpy).toHaveBeenCalledWith('local')

    await selectConnection(/Local ComfyUI/)
    expect(connectionSpy).toHaveBeenCalledTimes(1)
  })

  it('dedupes client tab captures per connection, not globally', async () => {
    render(SetupSection, { props: { locale: 'en' } })

    await selectTab('Codex')
    expect(clientSpy).toHaveBeenCalledTimes(1)
    expect(clientSpy).toHaveBeenCalledWith('codex')

    await selectTab('Codex')
    expect(clientSpy).toHaveBeenCalledTimes(1)

    // The same client under the other connection is a distinct selection.
    await selectConnection(/Local ComfyUI/)
    await selectTab('Codex')
    expect(clientSpy).toHaveBeenCalledTimes(2)
    expect(clientSpy).toHaveBeenLastCalledWith('codex')

    await selectTab('Codex')
    expect(clientSpy).toHaveBeenCalledTimes(2)
  })
})
