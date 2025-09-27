import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import InputSlot from '@/renderer/extensions/vueNodes/components/InputSlot.vue'
import SlotConnectionDot from '@/renderer/extensions/vueNodes/components/SlotConnectionDot.vue'

// Mock the slot error state composable
const mockSetSlotError = vi.fn()
const mockHasSlotError = vi.fn()
const mockClearNodeErrors = vi.fn()
const mockClearAllErrors = vi.fn()

vi.mock('@/renderer/extensions/vueNodes/composables/useSlotErrorState', () => ({
  useSlotErrorState: () => ({
    setSlotError: mockSetSlotError,
    hasSlotError: mockHasSlotError,
    clearNodeErrors: mockClearNodeErrors,
    clearAllErrors: mockClearAllErrors,
    slotErrorState: ref(new Map())
  })
}))

// Mock other dependencies
vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    toastErrorHandler: vi.fn()
  })
}))

vi.mock('@/constants/slotColors', () => ({
  getSlotColor: (type: string) =>
    type === 'error' ? 'var(--color-error)' : '#888'
}))

vi.mock('@/renderer/extensions/vueNodes/composables/useNodeTooltips', () => ({
  useNodeTooltips: () => ({
    getInputSlotTooltip: vi.fn(),
    createTooltipConfig: vi.fn(() => ({}))
  })
}))

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useSlotElementTracking',
  () => ({
    useSlotElementTracking: vi.fn()
  })
)

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction',
  () => ({
    useSlotLinkInteraction: () => ({
      onPointerDown: vi.fn()
    })
  })
)

describe('InputSlot Error State Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasSlotError.mockReturnValue(false) // Default to no errors
  })

  it('should use reactive state for error styling on dot and label', async () => {
    // Mock slot error state to return true for this node/slot
    mockHasSlotError.mockReturnValue(true)

    const wrapper = mount(InputSlot, {
      props: {
        slotData: {
          name: 'vae',
          type: 'VAE',
          boundingRect: [0, 0, 0, 0]
        },
        index: 1,
        nodeId: 'test-node'
      },
      global: {
        provide: {
          tooltipContainer: ref(null)
        }
      }
    })

    // Verify the reactive state was queried correctly
    expect(mockHasSlotError).toHaveBeenCalledWith('test-node', 1, 'input')

    // Should apply error classes to the connection dot
    const connectionDot = wrapper.findComponent(SlotConnectionDot)
    expect(connectionDot.exists()).toBe(true)
    expect(connectionDot.classes()).toContain('ring-error')
    expect(connectionDot.classes()).toContain('ring-2')
    expect(connectionDot.classes()).toContain('rounded-full')

    // Should apply error classes to the label
    const labelElement = wrapper.find('span')
    expect(labelElement.exists()).toBe(true)
    expect(labelElement.classes()).toContain('text-error')
    expect(labelElement.classes()).toContain('font-medium')
  })

  it('should not apply error styling when no error in reactive state', async () => {
    // Mock returns false (no error) - this is the default from beforeEach
    const wrapper = mount(InputSlot, {
      props: {
        slotData: {
          name: 'samples',
          type: 'LATENT',
          boundingRect: [0, 0, 0, 0]
        },
        index: 0,
        nodeId: 'test-node'
      },
      global: {
        provide: {
          tooltipContainer: ref(null)
        }
      }
    })

    // Verify the reactive state was queried
    expect(mockHasSlotError).toHaveBeenCalledWith('test-node', 0, 'input')

    // Should not apply error classes to connection dot
    const connectionDot = wrapper.findComponent(SlotConnectionDot)
    expect(connectionDot.exists()).toBe(true)
    expect(connectionDot.classes()).not.toContain('ring-error')

    // Should apply normal label classes (not error classes)
    const labelElement = wrapper.find('span')
    expect(labelElement.exists()).toBe(true)
    expect(labelElement.classes()).not.toContain('text-error')
    expect(labelElement.classes()).not.toContain('font-medium')
    expect(labelElement.classes()).toContain('text-stone-200')
  })
})
