import { VueWrapper, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToggleSwitch from 'primevue/toggleswitch'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'

import PackEnableToggle from './PackEnableToggle.vue'

// Mock debounce to execute immediately
vi.mock('lodash', () => ({
  debounce: <T extends (...args: any[]) => any>(fn: T) => fn
}))

const mockNodePack = {
  id: 'test-pack',
  name: 'Test Pack',
  latest_version: {
    version: '1.0.0',
    createdAt: '2023-01-01T00:00:00Z'
  }
}

const mockIsPackEnabled = vi.fn()
const mockEnablePack = { call: vi.fn().mockResolvedValue(undefined) }
const mockDisablePack = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/comfyManagerStore', () => ({
  useComfyManagerStore: vi.fn(() => ({
    isPackEnabled: mockIsPackEnabled,
    enablePack: mockEnablePack,
    disablePack: mockDisablePack,
    installedPacks: {}
  }))
}))

describe('PackEnableToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPackEnabled.mockReset()
    mockEnablePack.call.mockReset().mockResolvedValue(undefined)
    mockDisablePack.mockReset().mockResolvedValue(undefined)
  })

  const mountComponent = ({
    props = {},
    installedPacks = {}
  }: Record<string, any> = {}): VueWrapper => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    vi.mocked(useComfyManagerStore).mockReturnValue({
      isPackEnabled: mockIsPackEnabled,
      enablePack: mockEnablePack,
      disablePack: mockDisablePack,
      installedPacks
    } as any)

    return mount(PackEnableToggle, {
      props: {
        nodePack: mockNodePack,
        ...props
      },
      global: {
        plugins: [PrimeVue, createPinia(), i18n]
      }
    })
  }

  it('renders a toggle switch', () => {
    mockIsPackEnabled.mockReturnValue(true)
    const wrapper = mountComponent()

    const toggleSwitch = wrapper.findComponent(ToggleSwitch)
    expect(toggleSwitch.exists()).toBe(true)
  })

  it('checks if pack is enabled on mount', () => {
    mockIsPackEnabled.mockReturnValue(true)
    mountComponent()

    expect(mockIsPackEnabled).toHaveBeenCalledWith(mockNodePack.id)
  })

  it('sets toggle to on when pack is enabled', () => {
    mockIsPackEnabled.mockReturnValue(true)
    const wrapper = mountComponent()

    const toggleSwitch = wrapper.findComponent(ToggleSwitch)
    expect(toggleSwitch.props('modelValue')).toBe(true)
  })

  it('sets toggle to off when pack is disabled', () => {
    mockIsPackEnabled.mockReturnValue(false)
    const wrapper = mountComponent()

    const toggleSwitch = wrapper.findComponent(ToggleSwitch)
    expect(toggleSwitch.props('modelValue')).toBe(false)
  })

  it('calls enablePack when toggle is switched on', async () => {
    mockIsPackEnabled.mockReturnValue(false)
    const wrapper = mountComponent()

    const toggleSwitch = wrapper.findComponent(ToggleSwitch)
    await toggleSwitch.vm.$emit('update:modelValue', true)

    expect(mockEnablePack.call).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockNodePack.id,
        version: mockNodePack.latest_version.version
      })
    )
  })

  it('calls disablePack when toggle is switched off', async () => {
    mockIsPackEnabled.mockReturnValue(true)
    const wrapper = mountComponent()

    const toggleSwitch = wrapper.findComponent(ToggleSwitch)
    await toggleSwitch.vm.$emit('update:modelValue', false)

    expect(mockDisablePack).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockNodePack.id,
        version: mockNodePack.latest_version.version
      })
    )
  })

  it('disables toggle while loading', async () => {
    const pendingPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 1000)
    })
    mockEnablePack.call.mockReturnValue(pendingPromise)

    mockIsPackEnabled.mockReturnValue(false)
    const wrapper = mountComponent()

    // Trigger the toggle
    const toggleSwitch = wrapper.findComponent(ToggleSwitch)
    await toggleSwitch.vm.$emit('update:modelValue', true)

    // Check that the toggle is disabled during loading
    await nextTick()
    expect(wrapper.findComponent(ToggleSwitch).props('disabled')).toBe(true)

    // Resolve the promise to simulate the operation completing
    await pendingPromise

    // Check that the toggle is enabled after the operation completes
    await nextTick()
    expect(wrapper.findComponent(ToggleSwitch).props('disabled')).toBe(false)
  })
})
