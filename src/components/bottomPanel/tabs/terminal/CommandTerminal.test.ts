import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import CommandTerminal from './CommandTerminal.vue'

const { fakeTerminal, autoSize, getTerminalBridge } = vi.hoisted(() => {
  const term = {
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    write: vi.fn(),
    resize: vi.fn(),
    reset: vi.fn(),
    element: { offsetParent: {} },
    cols: 80,
    rows: 30
  }
  return {
    fakeTerminal: term,
    autoSize: vi.fn(),
    getTerminalBridge: vi.fn()
  }
})

vi.mock('@/composables/bottomPanelTabs/useTerminalBridge', () => ({
  getTerminalBridge
}))

// Stub BaseTerminal: synchronously hand the component a fake xterm terminal.
vi.mock('./BaseTerminal.vue', () => ({
  default: defineComponent({
    emits: ['created'],
    setup(_props, { emit }) {
      emit(
        'created',
        { terminal: fakeTerminal, useAutoSize: autoSize },
        ref(undefined)
      )
      return () => h('div', { 'data-testid': 'base-terminal-stub' })
    }
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { terminal: { sessionEnded: 'ended', restart: 'restart' } }
  }
})

function renderTerminal() {
  return render(CommandTerminal, { global: { plugins: [i18n] } })
}

function makeLauncherBridge() {
  let exitCb: (() => void) | undefined
  return {
    subscribe: vi.fn().mockResolvedValue({
      buffer: [],
      size: { cols: 80, rows: 30 },
      exited: false
    }),
    write: vi.fn().mockResolvedValue(undefined),
    resize: vi.fn().mockResolvedValue(undefined),
    restart: vi.fn().mockResolvedValue({
      buffer: [],
      size: { cols: 80, rows: 30 },
      exited: false
    }),
    onOutput: vi.fn(() => () => {}),
    onExited: vi.fn((cb: () => void) => {
      exitCb = cb
      return () => {}
    }),
    fireExit: () => exitCb?.()
  }
}

describe('CommandTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows the restart banner when the session exits and clears it on restart', async () => {
    const bridge = makeLauncherBridge()
    getTerminalBridge.mockReturnValue(bridge)

    renderTerminal()
    await waitFor(() => expect(bridge.subscribe).toHaveBeenCalled())

    expect(screen.queryByTestId('terminal-session-ended')).toBeNull()

    bridge.fireExit()
    expect(await screen.findByTestId('terminal-session-ended')).toBeTruthy()

    await userEvent.click(screen.getByTestId('terminal-restart-button'))
    expect(bridge.restart).toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByTestId('terminal-session-ended')).toBeNull()
    )
  })

  it('auto-restarts when re-opened after the user killed the session', async () => {
    const bridge = makeLauncherBridge()
    bridge.subscribe.mockResolvedValue({
      buffer: [],
      size: { cols: 80, rows: 30 },
      exited: true
    })
    getTerminalBridge.mockReturnValue(bridge)

    renderTerminal()

    await waitFor(() => expect(bridge.restart).toHaveBeenCalled())
  })

  it('does not offer restart on a legacy host that cannot restart', async () => {
    const legacy = {
      subscribe: vi
        .fn()
        .mockResolvedValue({ buffer: [], size: { cols: 80, rows: 30 } }),
      write: vi.fn().mockResolvedValue(undefined),
      resize: vi.fn().mockResolvedValue(undefined),
      restart: null,
      onOutput: vi.fn(() => () => {}),
      onExited: null
    }
    getTerminalBridge.mockReturnValue(legacy)

    renderTerminal()
    await waitFor(() => expect(legacy.subscribe).toHaveBeenCalled())

    // No exit notifications on legacy, so the banner never shows.
    expect(screen.queryByTestId('terminal-session-ended')).toBeNull()
  })
})
