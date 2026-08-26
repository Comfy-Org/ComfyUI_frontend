// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SetupSection from './SetupSection.vue'

const { connectionSpy, clientSpy } = vi.hoisted(() => ({
  connectionSpy: vi.fn(),
  clientSpy: vi.fn()
}))

vi.mock('../../scripts/posthog', () => ({
  captureMcpConnectionTabClick: connectionSpy,
  captureMcpClientTabClick: clientSpy
}))

const MCP_ENDPOINT = 'https://cloud.comfy.org/mcp'

function renderSetup() {
  return render(SetupSection, {
    props: { locale: 'en' },
    // The walkthrough clip is irrelevant here and <video> is inert in
    // happy-dom, so stub it out.
    global: { stubs: { VideoPlayer: true } }
  })
}

// reka-ui tab triggers activate on the pointer sequence, not a bare synthetic
// click, so drive them through userEvent.
async function selectTab(name: RegExp | string) {
  await userEvent.click(screen.getByRole('tab', { name }))
}

describe('SetupSection', () => {
  beforeEach(() => {
    connectionSpy.mockClear()
    clientSpy.mockClear()
  })

  it('defaults to the cloud connection with the endpoint URL and subscription note', () => {
    renderSetup()

    expect(screen.getByText(MCP_ENDPOINT)).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'subscription of any tier' })
    ).toBeTruthy()
    // Local-only content stays unmounted until the local tab is selected.
    expect(screen.queryByText('pip install comfy-mcp')).toBeNull()
    expect(screen.queryByText('Recommended')).toBeNull()
  })

  it('swaps in the open-source install flow when local is selected', async () => {
    renderSetup()
    await selectTab(/Local ComfyUI/)

    expect(screen.getByText('pip install comfy-mcp')).toBeTruthy()
    expect(
      screen.getByText('claude mcp add comfy-mcp -- comfy-mcp')
    ).toBeTruthy()
    expect(screen.getByText('Recommended')).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'open source on GitHub' })
        .getAttribute('href')
    ).toBe('https://github.com/Comfy-Org/comfy-mcp')
    // The cloud-only subscription note is replaced, not shown alongside.
    expect(
      screen.queryByRole('link', { name: 'subscription of any tier' })
    ).toBeNull()
  })

  it('restores the cloud panel when switching back', async () => {
    renderSetup()
    await selectTab(/Local ComfyUI/)
    await selectTab(/Comfy Cloud/)

    expect(screen.getByText(MCP_ENDPOINT)).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'subscription of any tier' })
    ).toBeTruthy()
    expect(screen.queryByText('pip install comfy-mcp')).toBeNull()
  })

  it('hands agents the markdown docs URLs in the ask-your-agent commands', async () => {
    renderSetup()

    // Cloud: the agent card appears on clients without a walkthrough clip.
    await selectTab('Claude Code Terminal')
    expect(
      screen.getByText(/docs\.comfy\.org\/agent-tools\/mcp\.md$/m)
    ).toBeTruthy()

    // Local: the default client pairs with the agent card and the local anchor.
    await selectTab(/Local ComfyUI/)
    expect(
      screen.getByText(
        /docs\.comfy\.org\/agent-tools\/mcp\.md#local-comfy-mcp-connection/
      )
    ).toBeTruthy()
  })

  it('captures analytics once per tab change, deduping re-clicks', async () => {
    renderSetup()

    await selectTab(/Local ComfyUI/)
    await selectTab(/Local ComfyUI/)
    expect(connectionSpy).toHaveBeenCalledTimes(1)
    expect(connectionSpy).toHaveBeenCalledWith('local')

    await selectTab('Cursor')
    expect(clientSpy).toHaveBeenCalledWith('local-cursor')
  })
})
