import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { ISettingGroup, SettingParams } from '@/types/settingTypes'

import SettingsPanel from './SettingsPanel.vue'

const meta: Meta<typeof SettingsPanel> = {
  title: 'Components/Setting/SettingsPanel',
  component: SettingsPanel,
  parameters: {
    layout: 'padded'
  },
  argTypes: {
    settingGroups: {
      control: 'object',
      description: 'Array of setting groups to display'
    }
  },
  decorators: [
    () => ({
      template: '<div style="max-width: 600px; padding: 16px;"><story /></div>'
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

const mockGeneralSettings: ISettingGroup = {
  label: 'General',
  settings: [
    createMockSetting({
      id: 'Comfy.Locale' as any,
      name: 'Language',
      type: 'combo',
      defaultValue: 'en',
      tooltip: 'Select your preferred language',
      options: [
        { text: 'English', value: 'en' },
        { text: 'Spanish', value: 'es' },
        { text: 'French', value: 'fr' },
        { text: 'German', value: 'de' }
      ]
    }),
    createMockSetting({
      id: 'Comfy.AutoSave' as any,
      name: 'Auto Save',
      type: 'boolean',
      defaultValue: true,
      tooltip: 'Automatically save your work'
    }),
    createMockSetting({
      id: 'Comfy.AutoSaveInterval' as any,
      name: 'Auto Save Interval (seconds)',
      type: 'number',
      defaultValue: 30,
      tooltip: 'How often to auto save in seconds',
      attrs: {
        min: 10,
        max: 300,
        step: 5
      }
    })
  ]
}

const mockAppearanceSettings: ISettingGroup = {
  label: 'Appearance',
  settings: [
    createMockSetting({
      id: 'Comfy.ColorPalette' as any,
      name: 'Color Palette',
      type: 'combo',
      defaultValue: 'dark',
      tooltip: 'Choose your color theme',
      options: [
        { text: 'Dark', value: 'dark' },
        { text: 'Light', value: 'light' },
        { text: 'Arc', value: 'arc' },
        { text: 'Nord', value: 'nord' }
      ]
    }),
    createMockSetting({
      id: 'Comfy.AccentColor' as any,
      name: 'Accent Color',
      type: 'color',
      defaultValue: '#007bff',
      tooltip: 'Choose your accent color'
    }),
    createMockSetting({
      id: 'Comfy.NodeOpacity' as any,
      name: 'Node Opacity',
      type: 'slider',
      defaultValue: 80,
      tooltip: 'Adjust node transparency',
      attrs: {
        min: 10,
        max: 100,
        step: 10
      }
    })
  ]
}

const mockPerformanceSettings: ISettingGroup = {
  label: 'Performance',
  settings: [
    createMockSetting({
      id: 'Comfy.MaxConcurrentTasks' as any,
      name: 'Max Concurrent Tasks',
      type: 'number',
      defaultValue: 4,
      tooltip: 'Maximum number of tasks to run simultaneously',
      attrs: {
        min: 1,
        max: 16
      }
    }),
    createMockSetting({
      id: 'Comfy.EnableGPUAcceleration' as any,
      name: 'GPU Acceleration',
      type: 'boolean',
      defaultValue: true,
      tooltip: 'Enable GPU acceleration for better performance',
      experimental: true
    }),
    createMockSetting({
      id: 'Comfy.CacheSize' as any,
      name: 'Cache Size (MB)',
      type: 'slider',
      defaultValue: 512,
      tooltip: 'Amount of memory to use for caching',
      attrs: {
        min: 128,
        max: 2048,
        step: 128
      }
    })
  ]
}

export const EmptyPanel: Story = {
  args: {
    settingGroups: []
  }
}

export const SingleGroup: Story = {
  args: {
    settingGroups: [mockGeneralSettings]
  }
}

export const MultipleGroups: Story = {
  args: {
    settingGroups: [
      mockGeneralSettings,
      mockAppearanceSettings,
      mockPerformanceSettings
    ]
  }
}

export const AppearanceOnly: Story = {
  args: {
    settingGroups: [mockAppearanceSettings]
  }
}

export const PerformanceOnly: Story = {
  args: {
    settingGroups: [mockPerformanceSettings]
  }
}

export const MixedInputTypes: Story = {
  args: {
    settingGroups: [
      {
        label: 'Mixed Settings',
        settings: [
          createMockSetting({
            id: 'mixed.boolean' as any,
            name: 'Boolean Setting',
            type: 'boolean',
            defaultValue: true
          }),
          createMockSetting({
            id: 'mixed.text' as any,
            name: 'Text Setting',
            type: 'text',
            defaultValue: 'Default text'
          }),
          createMockSetting({
            id: 'mixed.number' as any,
            name: 'Number Setting',
            type: 'number',
            defaultValue: 42
          }),
          createMockSetting({
            id: 'mixed.slider' as any,
            name: 'Slider Setting',
            type: 'slider',
            defaultValue: 75,
            attrs: { min: 0, max: 100 }
          }),
          createMockSetting({
            id: 'mixed.combo' as any,
            name: 'Combo Setting',
            type: 'combo',
            defaultValue: 'option2',
            options: [
              { text: 'Option 1', value: 'option1' },
              { text: 'Option 2', value: 'option2' },
              { text: 'Option 3', value: 'option3' }
            ]
          }),
          createMockSetting({
            id: 'mixed.color' as any,
            name: 'Color Setting',
            type: 'color',
            defaultValue: '#ff6b35'
          })
        ]
      }
    ]
  }
}
