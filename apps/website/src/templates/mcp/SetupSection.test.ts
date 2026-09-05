// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Locale } from '../../i18n/translations'
import type * as McpClientConfig from '../../config/mcpClients'
import type { McpConnections } from '../../config/mcpClients'
import SetupSection from './SetupSection.vue'

const { connectionSpy, clientSpy } = vi.hoisted(() => ({
  connectionSpy: vi.fn(),
  clientSpy: vi.fn()
}))

vi.mock('../../scripts/posthog', () => ({
  captureMcpConnectionTabClick: connectionSpy,
  captureMcpClientTabClick: clientSpy
}))

vi.mock('../../config/mcpClients', async (importOriginal) => {
  const actual = await importOriginal<typeof McpClientConfig>()

  return {
    ...actual,
    createMcpConnections: (locale: Locale): McpConnections => {
      const connections: McpConnections = actual.createMcpConnections(locale)
      connections.cloud.clients.codex = undefined
      return connections
    }
  }
})

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

  it('omits unavailable clients from tabs and instructions', async () => {
    renderSetup()

    expect(screen.queryByRole('tab', { name: 'Codex' })).toBeNull()
    expect(screen.queryByText(/codex mcp add comfy-cloud/)).toBeNull()

    await selectTab('Claude Code Terminal')
    expect(
      screen.getByText(/claude mcp add --transport http comfy-cloud/)
    ).toBeTruthy()
  })

  it('captures connection tab analytics once per selection', async () => {
    renderSetup()

    await selectTab(/Local ComfyUI/)
    await selectTab(/Local ComfyUI/)
    await selectTab(/Comfy Cloud/)
    await selectTab(/Comfy Cloud/)

    expect(connectionSpy.mock.calls).toEqual([['local'], ['cloud']])
  })

  it('captures client tab analytics once per selection', async () => {
    renderSetup()

    await selectTab('Cursor')
    await selectTab('Cursor')
    await selectTab(/Local ComfyUI/)
    await selectTab('Cursor')
    await selectTab('Cursor')

    expect(clientSpy.mock.calls).toEqual([['cursor'], ['local-cursor']])
  })
})
