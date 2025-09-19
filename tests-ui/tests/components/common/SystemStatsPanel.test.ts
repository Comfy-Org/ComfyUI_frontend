import { mount } from '@vue/test-utils'
import TabView from 'primevue/tabview'
import { describe, expect, it, vi } from 'vitest'

import DeviceInfo from '@/components/common/DeviceInfo.vue'
import SystemStatsPanel from '@/components/common/SystemStatsPanel.vue'
import type { SystemStats } from '@/schemas/apiSchema'

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: vi.fn((key: string) => key)
  }))
}))

describe('SystemStatsPanel', () => {
  const mockSystemStats: SystemStats = {
    system: {
      os: 'Windows 11',
      python_version: '3.11.7',
      embedded_python: false,
      comfyui_version: '1.26.7',
      pytorch_version: '2.1.2',
      argv: ['--auto-launch'],
      ram_total: 17179869184,
      ram_free: 8589934592
    },
    devices: [
      {
        name: 'NVIDIA GeForce RTX 4090',
        type: 'cuda',
        index: 0,
        vram_total: 24564224000,
        vram_free: 20564224000,
        torch_vram_total: 24564224000,
        torch_vram_free: 20564224000
      },
      {
        name: 'Intel UHD Graphics',
        type: 'cpu',
        index: 1,
        vram_total: 0,
        vram_free: 0,
        torch_vram_total: 0,
        torch_vram_free: 0
      }
    ]
  }

  const createWrapper = (stats: SystemStats) => {
    return mount(SystemStatsPanel, {
      props: { stats },
      global: {
        components: {
          DeviceInfo,
          TabView
        }
      }
    })
  }

  describe('Normal operation', () => {
    it('should render system information correctly', () => {
      const wrapper = createWrapper(mockSystemStats)

      expect(wrapper.text()).toContain('Windows 11')
      expect(wrapper.text()).toContain('3.11.7')
      expect(wrapper.text()).toContain('1.26.7')
    })

    it('should render single device without tabs when only one device', () => {
      const singleDeviceStats = {
        ...mockSystemStats,
        devices: [mockSystemStats.devices[0]]
      }

      const wrapper = createWrapper(singleDeviceStats)
      expect(wrapper.findComponent(TabView).exists()).toBe(false)
      expect(wrapper.findComponent(DeviceInfo).exists()).toBe(true)
    })

    it('should render multiple devices with tabs', () => {
      const wrapper = createWrapper(mockSystemStats)
      expect(wrapper.findComponent(TabView).exists()).toBe(true)
    })
  })

  describe('Sentry Issue CLOUD-FRONTEND-STAGING-13: Edge cases leading to undefined device', () => {
    it('should fail when devices array is empty and accessing devices[0]', () => {
      const emptyDevicesStats: SystemStats = {
        ...mockSystemStats,
        devices: []
      }

      expect(() => {
        createWrapper(emptyDevicesStats)
      }).toThrow()
    })

    it('should fail when devices array is undefined', () => {
      const undefinedDevicesStats = {
        ...mockSystemStats,
        devices: undefined as any
      }

      expect(() => {
        createWrapper(undefinedDevicesStats)
      }).toThrow()
    })

    it('should fail when devices array contains undefined elements', () => {
      const statsWithUndefinedDevice: SystemStats = {
        ...mockSystemStats,
        devices: [
          mockSystemStats.devices[0],
          undefined as any, // This simulates corrupted data
          mockSystemStats.devices[1]
        ]
      }

      expect(() => {
        createWrapper(statsWithUndefinedDevice)
      }).toThrow()
    })

    it('should fail when API returns malformed SystemStats structure', () => {
      // Simulate various API response corruption scenarios
      const malformedStats = [
        // Missing devices property
        {
          system: mockSystemStats.system
          // devices property missing entirely
        } as any,

        // Devices is not an array
        {
          system: mockSystemStats.system,
          devices: 'not-an-array'
        } as any,

        // Devices is null
        {
          system: mockSystemStats.system,
          devices: null
        } as any
      ]

      malformedStats.forEach((stats, index) => {
        expect(
          () => {
            createWrapper(stats)
          },
          `Malformed stats scenario ${index + 1} should throw`
        ).toThrow()
      })
    })
  })

  describe('Device selection logic edge cases', () => {
    it('should fail when v-else condition tries to access devices[0] on empty array', () => {
      // This tests the specific template logic: <DeviceInfo v-else :device="props.stats.devices[0]" />
      const emptyDevicesStats: SystemStats = {
        ...mockSystemStats,
        devices: []
      }

      // The v-else condition should trigger since devices.length > 1 is false
      // But devices[0] will be undefined
      expect(() => {
        createWrapper(emptyDevicesStats)
      }).toThrow()
    })

    it('should handle concurrent modification of devices array', () => {
      // Simulate race condition where devices array gets modified after component creation
      const mutableStats = { ...mockSystemStats }
      const wrapper = createWrapper(mutableStats)

      // Simulate external modification (e.g., store update)
      mutableStats.devices = []

      expect(wrapper.exists()).toBe(true) // Component should still exist
    })
  })

  describe('Integration with systemStatsStore scenarios', () => {
    it('should fail when store returns partial/corrupted data', () => {
      // Simulate systemStatsStore.systemStats returning incomplete data
      const partialStats = {
        system: undefined,
        devices: undefined
      } as any

      expect(() => {
        createWrapper(partialStats)
      }).toThrow()
    })

    it('should fail when API response parsing fails', () => {
      // Simulate JSON parsing errors leading to unexpected structure
      const corruptedStats = {
        system: mockSystemStats.system,
        devices: [
          {
            name: 'Device 1'
            // Missing required fields
          } as any
        ]
      }

      expect(() => {
        createWrapper(corruptedStats)
      }).toThrow()
    })
  })
})
