import { describe, expect, it } from 'vitest'

import { useInputDeviceDetection } from '@/platform/settings/composables/useInputDeviceDetection'

describe('useInputDeviceDetection', () => {
  it('exposes a default detected device of "mouse"', () => {
    const { detectedInputDevice } = useInputDeviceDetection()
    expect(
      detectedInputDevice.value === 'mouse' ||
        detectedInputDevice.value === 'trackpad'
    ).toBe(true)
  })

  it('returns the same singleton ref across calls', () => {
    const first = useInputDeviceDetection().detectedInputDevice
    const second = useInputDeviceDetection().detectedInputDevice
    expect(first).toBe(second)
  })

  it('propagates writes through the shared ref', () => {
    const { detectedInputDevice } = useInputDeviceDetection()
    const previous = detectedInputDevice.value
    detectedInputDevice.value = 'trackpad'
    expect(useInputDeviceDetection().detectedInputDevice.value).toBe('trackpad')
    detectedInputDevice.value = previous
  })
})
