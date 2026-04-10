import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ConnectionPanelView from './ConnectionPanelView.vue'

vi.mock('@/utils/envUtil', () => ({
  electronAPI: vi.fn(() => ({ changeTheme: vi.fn() })),
  isNativeWindow: vi.fn(() => false)
}))

vi.mock('@/platform/distribution/types', () => ({
  isDesktop: false
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

function mountPanel() {
  return mount(ConnectionPanelView, {
    global: {
      plugins: [i18n]
    }
  })
}

describe('ConnectionPanelView', () => {
  beforeEach(() => {
    mockLocalStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders the backend URL input', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('#backend-url').exists()).toBe(true)
  })

  it('defaults the backend URL to http://127.0.0.1:8188', () => {
    const wrapper = mountPanel()
    const input = wrapper.find('#backend-url').element as HTMLInputElement
    expect(input.value).toBe('http://127.0.0.1:8188')
  })

  it('loads backend URL from localStorage', () => {
    mockLocalStorage.setItem(
      'comfyui-preview-backend-url',
      'http://192.168.1.100:8188'
    )
    const wrapper = mountPanel()
    const input = wrapper.find('#backend-url').element as HTMLInputElement
    expect(input.value).toBe('http://192.168.1.100:8188')
  })

  it('shows test button', () => {
    const wrapper = mountPanel()
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('displays the command-line guide', () => {
    const wrapper = mountPanel()
    expect(wrapper.text()).toContain('python main.py --enable-cors-header="*"')
  })

  it('shows build info in footer', () => {
    const wrapper = mountPanel()
    const footer = wrapper.find('footer')
    expect(footer.exists()).toBe(true)
  })

  it('does not show status indicators before testing', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('.bg-green-500').exists()).toBe(false)
    expect(wrapper.find('.bg-red-500').exists()).toBe(false)
  })

  it('saves URL to localStorage on test', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    const wrapper = mountPanel()
    await wrapper.find('#backend-url').setValue('http://10.0.0.1:8188')

    const testButton = wrapper.findAll('button')[0]
    await testButton.trigger('click')

    await vi.waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'comfyui-preview-backend-url',
        'http://10.0.0.1:8188'
      )
    })
  })
})
