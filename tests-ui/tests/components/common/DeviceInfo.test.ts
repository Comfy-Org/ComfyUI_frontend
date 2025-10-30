import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DeviceInfo from '@/components/common/DeviceInfo.vue'
import type { DeviceStats } from '@/schemas/apiSchema'

describe('DeviceInfo', () => {
  const validDevice: DeviceStats = {
    name: 'NVIDIA GeForce RTX 4090',
    type: 'cuda',
    index: 0,
    vram_total: 24564224000,
    vram_free: 20564224000,
    torch_vram_total: 24564224000,
    torch_vram_free: 20564224000
  }

  const createWrapper = (device: DeviceStats | undefined) => {
    return mount(DeviceInfo, {
      props: { device } as any
    })
  }

  describe('Normal operation', () => {
    it('should render device information correctly with valid device', () => {
      const wrapper = createWrapper(validDevice)

      expect(wrapper.text()).toContain('NVIDIA GeForce RTX 4090')
      expect(wrapper.text()).toContain('cuda')
      expect(wrapper.text()).toContain('22.88 GB') // vram_total formatted
      expect(wrapper.text()).toContain('19.15 GB') // vram_free formatted
    })

    it('should display all device columns', () => {
      const wrapper = createWrapper(validDevice)
      const headers = wrapper.findAll('.font-medium')

      expect(headers).toHaveLength(6)
      expect(headers[0].text()).toBe('Name')
      expect(headers[1].text()).toBe('Type')
      expect(headers[2].text()).toBe('VRAM Total')
      expect(headers[3].text()).toBe('VRAM Free')
      expect(headers[4].text()).toBe('Torch VRAM Total')
      expect(headers[5].text()).toBe('Torch VRAM Free')
    })
  })

  describe('Sentry Issue CLOUD-FRONTEND-STAGING-13: undefined device prop - FIXED', () => {
    it('should gracefully handle undefined device prop instead of throwing', () => {
      // Previously this threw TypeError, now it should render error message
      const wrapper = createWrapper(undefined as any)
      expect(wrapper.text()).toContain('g.deviceNotAvailable')
      expect(wrapper.find('.text-red-500').exists()).toBe(true)
    })

    it('should gracefully handle undefined device properties instead of throwing', () => {
      // Previously threw TypeError: Cannot read properties of undefined (reading 'name')
      // Now should render fallback message
      const wrapper = mount(DeviceInfo, {
        props: { device: undefined as any }
      })

      expect(wrapper.html()).toContain('g.deviceNotAvailable')
      expect(() => wrapper.html()).not.toThrow()
    })

    it('should fail when formatValue tries to access undefined device fields', () => {
      // Simulate the exact scenario from the stack trace
      const mockDeviceColumns = [
        { field: 'name', header: 'Name' },
        { field: 'type', header: 'Type' },
        { field: 'vram_total', header: 'VRAM Total' }
      ]

      expect(() => {
        const undefinedDevice = undefined as any
        mockDeviceColumns.forEach((col) => {
          // This simulates: formatValue(props.device[col.field], col.field)
          // where props.device is undefined
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          undefinedDevice[col.field] // This should throw
        })
      }).toThrow(TypeError)
    })
  })

  describe('Edge cases that could lead to undefined device - FIXED', () => {
    it('should gracefully handle device with missing required fields', () => {
      const incompleteDevice = {
        name: 'Test Device'
        // Missing required fields: type, index, vram_total, etc.
      } as any

      const wrapper = createWrapper(incompleteDevice)
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('Test Device')
      expect(wrapper.text()).toContain('N/A') // Missing fields show as N/A
    })

    it('should handle device with null values gracefully', () => {
      const deviceWithNulls = {
        name: null,
        type: null,
        index: 0,
        vram_total: null,
        vram_free: null,
        torch_vram_total: null,
        torch_vram_free: null
      } as any

      const wrapper = createWrapper(deviceWithNulls)
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('N/A') // Null values show as N/A
    })
  })

  describe('SystemStatsPanel integration scenarios - FIXED', () => {
    it('should gracefully handle when devices array is empty and accessing devices[0]', () => {
      // This simulates the scenario where props.stats.devices[0] is undefined
      // because the devices array is empty
      const emptyDevicesArray: DeviceStats[] = []

      const deviceFromEmptyArray = emptyDevicesArray[0] // undefined
      const wrapper = createWrapper(deviceFromEmptyArray)

      expect(wrapper.text()).toContain('g.deviceNotAvailable')
      expect(() => createWrapper(deviceFromEmptyArray)).not.toThrow()
    })

    it('should gracefully handle when SystemStats API returns malformed data', () => {
      // Simulate API returning data that doesn't match expected schema
      const malformedApiResponse = {
        system: {
          /* valid system data */
        },
        devices: null // This should be an array but API returned null
      }

      const deviceFromMalformedData = malformedApiResponse.devices?.[0]
      const wrapper = createWrapper(deviceFromMalformedData)

      expect(wrapper.text()).toContain('g.deviceNotAvailable')
      expect(() => createWrapper(deviceFromMalformedData)).not.toThrow()
    })
  })

  describe('formatValue function edge cases - FIXED', () => {
    it('should gracefully handle undefined values in VRAM fields', () => {
      const deviceWithUndefinedVram = {
        name: 'Test Device',
        type: 'cuda',
        index: 0,
        vram_total: undefined,
        vram_free: undefined,
        torch_vram_total: undefined,
        torch_vram_free: undefined
      } as any

      // Previously would fail, now should show N/A for undefined VRAM values
      const wrapper = createWrapper(deviceWithUndefinedVram)
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('Test Device')
      expect(wrapper.text()).toContain('cuda')
      expect(wrapper.text()).toContain('N/A') // Undefined VRAM values show as N/A
    })
  })
})
