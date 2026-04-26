import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ConnectionPanelView from './ConnectionPanelView.vue'

vi.mock('@/utils/envUtil', () => ({
  electronAPI: vi.fn(() => ({ changeTheme: vi.fn() })),
  isNativeWindow: vi.fn(() => false)
}))

vi.mock('@/platform/distribution/types', () => ({
  isDesktop: false,
  isCloud: false,
  isNightly: false
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}))

const mockLocalStorage = vi.hoisted(() => {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      for (const key of Object.keys(store)) delete store[key]
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    _store: store
  }
})

vi.stubGlobal('localStorage', mockLocalStorage)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

function renderPanel() {
  return render(ConnectionPanelView, {
    global: {
      plugins: [i18n]
    }
  })
}

describe('ConnectionPanelView', () => {
  beforeEach(() => {
    mockLocalStorage.clear()
    vi.restoreAllMocks()
    vi.stubGlobal('localStorage', mockLocalStorage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the backend URL input with default value', () => {
    renderPanel()
    const input = screen.getByDisplayValue(
      'http://127.0.0.1:8188'
    ) as HTMLInputElement
    expect(input).toBeTruthy()
  })

  it('loads backend URL from localStorage', () => {
    mockLocalStorage.setItem(
      'comfyui-preview-backend-url',
      'http://192.168.1.100:8188'
    )
    renderPanel()
    const input = screen.getByDisplayValue(
      'http://192.168.1.100:8188'
    ) as HTMLInputElement
    expect(input).toBeTruthy()
  })

  it('shows test button', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: /test/i })).toBeTruthy()
  })

  it('displays the comfy-cli install command', () => {
    renderPanel()
    expect(screen.getByText('pip install comfy-cli')).toBeTruthy()
  })

  it('displays the comfy launch command', () => {
    renderPanel()
    expect(
      screen.getByText(
        `comfy launch -- --enable-cors-header="${window.location.origin}"`
      )
    ).toBeTruthy()
  })

  it('displays the local network access section', () => {
    renderPanel()
    expect(
      screen.getByRole('heading', { level: 2, name: /local/i })
    ).toBeTruthy()
  })

  it('saves URL to localStorage on test', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    renderPanel()
    const user = userEvent.setup()
    const input = screen.getByDisplayValue(
      'http://127.0.0.1:8188'
    ) as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'http://10.0.0.1:8188')

    const testButton = screen.getByRole('button', { name: /test/i })
    await user.click(testButton)

    await vi.waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'comfyui-preview-backend-url',
        'http://10.0.0.1:8188'
      )
    })
  })

  it('shows red HTTP indicator when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    // Stub WebSocket to never open so wsStatus also resolves to false
    class StubWS {
      addEventListener(type: string, cb: () => void) {
        if (type === 'error') setTimeout(cb, 0)
      }
      close() {}
    }
    vi.stubGlobal('WebSocket', StubWS as unknown as typeof WebSocket)

    renderPanel()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /test/i }))

    await vi.waitFor(() => {
      // i18n in tests is empty so the status text falls back to the key
      expect(screen.getByText(/connectionPanel\.error/)).toBeTruthy()
    })
  })

  it('normalizes a URL without protocol by prepending http://', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    renderPanel()
    const user = userEvent.setup()
    const input = screen.getByDisplayValue(
      'http://127.0.0.1:8188'
    ) as HTMLInputElement
    await user.clear(input)
    await user.type(input, '192.168.1.50:8188')
    await user.click(screen.getByRole('button', { name: /test/i }))

    await vi.waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'comfyui-preview-backend-url',
        'http://192.168.1.50:8188'
      )
    })
  })

  it('parses backend cloud API base from system_stats argv', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              system: {
                argv: [
                  'main.py',
                  '--enable-cors-header=*',
                  '--comfy-api-base',
                  'https://stagingapi.comfy.org'
                ]
              }
            })
        } as Response)
      )
    )
    class StubWS {
      addEventListener(type: string, cb: () => void) {
        if (type === 'open') setTimeout(cb, 0)
      }
      close() {}
    }
    vi.stubGlobal('WebSocket', StubWS as unknown as typeof WebSocket)

    renderPanel()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /test/i }))

    await vi.waitFor(() => {
      expect(screen.getByText('https://stagingapi.comfy.org')).toBeTruthy()
    })
  })

  it('reveals Connect & Open ComfyUI button after a successful HTTP test', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ system: { argv: [] } })
        } as Response)
      )
    )
    class StubWS {
      addEventListener(type: string, cb: () => void) {
        if (type === 'open') setTimeout(cb, 0)
      }
      close() {}
    }
    vi.stubGlobal('WebSocket', StubWS as unknown as typeof WebSocket)

    renderPanel()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /test/i }))

    await vi.waitFor(() => {
      // i18n in tests is empty so the button label falls back to the key
      expect(screen.getByText('connectionPanel.connectAndGo')).toBeTruthy()
    })
  })
})
