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
      expect(wrapper.text()).toContain('22.9 GB') // vram_total formatted
      expect(wrapper.text()).toContain('19.1 GB') // vram_free formatted
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

  describe('Sentry Issue CLOUD-FRONTEND-STAGING-13: undefined device prop', () => {
    it('should throw TypeError when device prop is undefined', () => {
      // This test reproduces the exact Sentry error
      expect(() => {
        createWrapper(undefined as any)
      }).toThrow()
    })

    it('should throw TypeError when accessing undefined device properties', () => {
      // Test the specific error: Cannot read properties of undefined (reading 'name')
      expect(() => {
        const wrapper = mount(DeviceInfo, {
          props: { device: undefined as any }
        })
        // This will trigger the error when Vue tries to render the template
        wrapper.html()
      }).toThrow(TypeError)
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

  describe('Edge cases that could lead to undefined device', () => {
    it('should handle device with missing required fields', () => {
      const incompleteDevice = {
        name: 'Test Device'
        // Missing required fields: type, index, vram_total, etc.
      } as any

      expect(() => {
        createWrapper(incompleteDevice)
      }).toThrow()
    })

    it('should handle device with null values', () => {
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
      // The component should render but may show null values
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('SystemStatsPanel integration scenarios', () => {
    it('should fail when devices array is empty and accessing devices[0]', () => {
      // This simulates the scenario where props.stats.devices[0] is undefined
      // because the devices array is empty
      const emptyDevicesArray: DeviceStats[] = []

      expect(() => {
        const deviceFromEmptyArray = emptyDevicesArray[0] // undefined
        createWrapper(deviceFromEmptyArray)
      }).toThrow()
    })

    it('should fail when SystemStats API returns malformed data', () => {
      // Simulate API returning data that doesn't match expected schema
      const malformedApiResponse = {
        system: {
          /* valid system data */
        },
        devices: null // This should be an array but API returned null
      }

      expect(() => {
        const deviceFromMalformedData = malformedApiResponse.devices?.[0]
        createWrapper(deviceFromMalformedData)
      }).toThrow()
    })
  })

  describe('formatValue function edge cases', () => {
    it('should handle undefined values in VRAM fields', () => {
      const deviceWithUndefinedVram = {
        name: 'Test Device',
        type: 'cuda',
        index: 0,
        vram_total: undefined,
        vram_free: undefined,
        torch_vram_total: undefined,
        torch_vram_free: undefined
      } as any

      // The component should render but formatValue might fail
      expect(() => {
        createWrapper(deviceWithUndefinedVram)
      }).toThrow()
    })
  })
})
