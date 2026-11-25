import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import LocalMcpSidebarTab from '@/platform/localMcp/components/LocalMcpSidebarTab.vue'
import {
  getLocalMcpAddress,
  getLocalMcpClients
} from '@/platform/localMcp/localMcpClients'
import { useLocalMcpStore } from '@/platform/localMcp/useLocalMcpStore'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const copyToClipboard = vi.hoisted(() => vi.fn())
vi.mock(import('@/composables/useCopyToClipboard'), () => ({
  useCopyToClipboard: () => ({ copied: ref(false), copyToClipboard })
}))
vi.mock(import('@comfyorg/telemetry'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderTab() {
  return render(LocalMcpSidebarTab, {
    global: {
      plugins: [i18n],
      stubs: {
        SidebarTabTemplate: { template: '<div><slot name="body" /></div>' }
      }
    }
  })
}

describe('LocalMcpSidebarTab', () => {
  beforeEach(() => {
    localStorage.clear()
    copyToClipboard.mockReset()
  })

  it('tracks the panel opening on mount', () => {
    const store = useLocalMcpStore()
    const trackOpened = vi.spyOn(store, 'trackOpened')
    renderTab()
    expect(trackOpened).toHaveBeenCalledOnce()
  })

  it('shows no connected banner at first', () => {
    renderTab()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.for(['claude_code', 'claude_desktop', 'cursor'])(
    'shows setup for %s',
    (id) => {
      renderTab()
      expect(screen.getByTestId(`local-mcp-client-${id}`)).toBeInTheDocument()
    }
  )

  it('shows the connected banner once an agent has connected', () => {
    useLocalMcpStore().connected = true
    renderTab()
    expect(screen.getByRole('status')).toHaveTextContent(/connected/i)
  })

  it('copies a client config and tracks the path chosen', async () => {
    const user = userEvent.setup()
    const store = useLocalMcpStore()
    const trackPathSelected = vi.spyOn(store, 'trackPathSelected')
    renderTab()

    await user.click(
      within(screen.getByTestId('local-mcp-client-cursor')).getByRole(
        'button',
        {
          name: /copy/i
        }
      )
    )

    const cursorConfig = getLocalMcpClients(
      getLocalMcpAddress(window.location)
    ).find((c) => c.id === 'cursor')!
    expect(copyToClipboard).toHaveBeenCalledWith(cursorConfig.config)
    expect(trackPathSelected).toHaveBeenCalledWith('cursor', 'copy_config')
  })

  it('tracks opening the docs', async () => {
    const user = userEvent.setup()
    const store = useLocalMcpStore()
    const trackPathSelected = vi.spyOn(store, 'trackPathSelected')
    renderTab()

    await user.click(screen.getByTestId('local-mcp-docs'))

    expect(trackPathSelected).toHaveBeenCalledWith(undefined, 'open_docs')
  })
})
