import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { SettingParams } from '@/types/settingTypes'

import SettingGroup from './SettingGroup.vue'

const meta: Meta<typeof SettingGroup> = {
  title: 'Components/Setting/SettingGroup',
  component: SettingGroup,
  parameters: {
    layout: 'padded'
  },
  argTypes: {
    group: {
      control: 'object',
      description: 'The setting group configuration'
    },
    divider: {
      control: 'boolean',
      description: 'Show divider above the group'
    }
  },
  decorators: [
    () => ({
      template: '<div style="max-width: 500px; padding: 16px;"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

const createMockSetting = (
  overrides: Partial<SettingParams> = {}
): SettingParams => ({
  id: 'test.setting' as any,
  name: 'Test Setting',
  type: 'boolean',
  defaultValue: false,
  ...overrides
})

export const BasicGroup: Story = {
  args: {
    group: {
      label: 'Basic Settings',
      settings: [
        createMockSetting({
          id: 'basic.enable' as any,
          name: 'Enable Feature',
          type: 'boolean',
          defaultValue: true,
          tooltip: 'Enable or disable this feature'
        }),
        createMockSetting({
          id: 'basic.name' as any,
          name: 'Display Name',
          type: 'text',
          defaultValue: 'My App',
          tooltip: 'The name to display in the title bar'
        })
      ]
    },
    divider: false
  }
}

export const GroupWithDivider: Story = {
  args: {
    group: {
      label: 'Advanced Settings',
      settings: [
        createMockSetting({
          id: 'advanced.debug' as any,
          name: 'Debug Mode',
          type: 'boolean',
          defaultValue: false,
          experimental: true,
          tooltip: 'Enable debug logging and developer tools'
        }),
        createMockSetting({
          id: 'advanced.timeout' as any,
          name: 'Request Timeout (ms)',
          type: 'number',
          defaultValue: 5000,
          tooltip: 'How long to wait for requests',
          attrs: {
            min: 1000,
            max: 30000,
            step: 500
          }
        })
      ]
    },
    divider: true
  }
}

export const PerformanceGroup: Story = {
  args: {
    group: {
      label: 'Performance',
      settings: [
        createMockSetting({
          id: 'perf.threads' as any,
          name: 'Worker Threads',
          type: 'slider',
          defaultValue: 4,
          tooltip: 'Number of worker threads to use',
          attrs: {
            min: 1,
            max: 16,
            step: 1
          }
        }),
        createMockSetting({
          id: 'perf.quality' as any,
          name: 'Render Quality',
          type: 'combo',
          defaultValue: 'high',
          tooltip: 'Rendering quality level',
          options: [
            { text: 'Low', value: 'low' },
            { text: 'Medium', value: 'medium' },
            { text: 'High', value: 'high' },
            { text: 'Ultra', value: 'ultra' }
          ]
        }),
        createMockSetting({
          id: 'perf.vsync' as any,
          name: 'V-Sync',
          type: 'boolean',
          defaultValue: true,
          tooltip: 'Enable vertical synchronization'
        })
      ]
    },
    divider: false
  }
}

export const EmptyGroup: Story = {
  args: {
    group: {
      label: 'Empty Group',
      settings: []
    },
    divider: false
  }
}
