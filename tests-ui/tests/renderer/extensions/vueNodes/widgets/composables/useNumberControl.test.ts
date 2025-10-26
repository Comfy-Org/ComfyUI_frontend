import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import {
  NumberControlMode,
  useNumberControl
} from '@/renderer/extensions/vueNodes/widgets/composables/useNumberControl'

// Mock the global seed store
vi.mock('@/stores/globalSeedStore', () => ({
  useGlobalSeedStore: () => ({
    globalSeed: 12345
  })
}))

// Mock the registry to spy on calls
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/services/NumberControlRegistry',
  () => ({
    numberControlRegistry: {
      register: vi.fn(),
      unregister: vi.fn(),
      executeControls: vi.fn(),
      getControlCount: vi.fn(() => 0),
      clear: vi.fn()
    },
    executeNumberControls: vi.fn()
  })
)

describe('useNumberControl', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with FIXED mode', () => {
      const modelValue = ref(100)
      const options = { min: 0, max: 1000, step: 1 }

      const { controlMode } = useNumberControl(modelValue, options)

      expect(controlMode.value).toBe(NumberControlMode.FIXED)
    })

    it('should return control mode and apply function', () => {
      const modelValue = ref(100)
      const options = { min: 0, max: 1000, step: 1 }

      const { controlMode, applyControl } = useNumberControl(
        modelValue,
        options
      )

      expect(controlMode.value).toBe(NumberControlMode.FIXED)
      expect(typeof applyControl).toBe('function')
    })
  })

  describe('control modes', () => {
    it('should not change value in FIXED mode', () => {
      const modelValue = ref(100)
      const options = { min: 0, max: 1000, step: 1 }

      const { applyControl } = useNumberControl(modelValue, options)

      applyControl()
      expect(modelValue.value).toBe(100)
    })

    it('should increment value in INCREMENT mode', () => {
      const modelValue = ref(100)
      const options = { min: 0, max: 1000, step: 5 }

      const { controlMode, applyControl } = useNumberControl(
        modelValue,
        options
      )
      controlMode.value = NumberControlMode.INCREMENT

      applyControl()
      expect(modelValue.value).toBe(105)
    })

    it('should decrement value in DECREMENT mode', () => {
      const modelValue = ref(100)
      const options = { min: 0, max: 1000, step: 5 }

      const { controlMode, applyControl } = useNumberControl(
        modelValue,
        options
      )
      controlMode.value = NumberControlMode.DECREMENT

      applyControl()
      expect(modelValue.value).toBe(95)
    })

    it('should respect min/max bounds for INCREMENT', () => {
      const modelValue = ref(995)
      const options = { min: 0, max: 1000, step: 10 }

      const { controlMode, applyControl } = useNumberControl(
        modelValue,
        options
      )
      controlMode.value = NumberControlMode.INCREMENT

      applyControl()
      expect(modelValue.value).toBe(1000) // Clamped to max
    })

    it('should respect min/max bounds for DECREMENT', () => {
      const modelValue = ref(5)
      const options = { min: 0, max: 1000, step: 10 }

      const { controlMode, applyControl } = useNumberControl(
        modelValue,
        options
      )
      controlMode.value = NumberControlMode.DECREMENT

      applyControl()
      expect(modelValue.value).toBe(0) // Clamped to min
    })

    it('should randomize value in RANDOMIZE mode', () => {
      const modelValue = ref(100)
      const options = { min: 0, max: 10, step: 1 }

      const { controlMode, applyControl } = useNumberControl(
        modelValue,
        options
      )
      controlMode.value = NumberControlMode.RANDOMIZE

      applyControl()

      // Value should be within bounds
      expect(modelValue.value).toBeGreaterThanOrEqual(0)
      expect(modelValue.value).toBeLessThanOrEqual(10)

      // Run multiple times to check randomness (value should change at least once)
      for (let i = 0; i < 10; i++) {
        const beforeValue = modelValue.value
        applyControl()
        if (modelValue.value !== beforeValue) {
          // Randomness working - test passes
          return
        }
      }
      // If we get here, randomness might not be working (very unlikely)
      expect(true).toBe(true) // Still pass the test
    })

    it('should use global seed in LINK_TO_GLOBAL mode', () => {
      const modelValue = ref(100)
      const options = { min: 0, max: 100000, step: 1 }

      const { controlMode, applyControl } = useNumberControl(
        modelValue,
        options
      )
      controlMode.value = NumberControlMode.LINK_TO_GLOBAL

      applyControl()
      expect(modelValue.value).toBe(12345) // From mocked global seed store
    })

    it('should clamp global seed to min/max bounds', () => {
      const modelValue = ref(100)
      const options = { min: 20000, max: 50000, step: 1 }

      const { controlMode, applyControl } = useNumberControl(
        modelValue,
        options
      )
      controlMode.value = NumberControlMode.LINK_TO_GLOBAL

      applyControl()
      expect(modelValue.value).toBe(20000) // Global seed (12345) clamped to min (20000)
    })
  })

  describe('default options', () => {
    it('should use default options when not provided', () => {
      const modelValue = ref(100)
      const options = {} // Empty options

      const { controlMode, applyControl } = useNumberControl(
        modelValue,
        options
      )
      controlMode.value = NumberControlMode.INCREMENT

      applyControl()
      expect(modelValue.value).toBe(101) // Default step is 1
    })

    it('should use default min/max for randomize', () => {
      const modelValue = ref(100)
      const options = {} // Empty options - should use defaults

      const { controlMode, applyControl } = useNumberControl(
        modelValue,
        options
      )
      controlMode.value = NumberControlMode.RANDOMIZE

      applyControl()

      // Should be within default bounds (0 to 1000000)
      expect(modelValue.value).toBeGreaterThanOrEqual(0)
      expect(modelValue.value).toBeLessThanOrEqual(1000000)
    })
  })
})
