import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { SettingParams } from '@/types/settingTypes'

import SettingItem from './SettingItem.vue'

const meta: Meta<typeof SettingItem> = {
  title: 'Components/Setting/SettingItem',
  component: SettingItem,
  parameters: {
    layout: 'padded'
  },
  argTypes: {
    setting: {
      control: 'object',
      description: 'The setting configuration object'
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
  tooltip: 'This is a test setting for demonstration purposes',
  ...overrides
})

export const BooleanSetting: Story = {
  args: {
    setting: createMockSetting({
      name: 'Enable Feature',
      type: 'boolean',
      defaultValue: true,
      tooltip: 'Toggle this feature on or off'
    })
  }
}

export const TextSetting: Story = {
  args: {
    setting: createMockSetting({
      name: 'API Endpoint',
      type: 'text',
      defaultValue: 'https://api.example.com',
      tooltip: 'The API endpoint to connect to'
    })
  }
}

export const NumberSetting: Story = {
  args: {
    setting: createMockSetting({
      name: 'Max Connections',
      type: 'number',
      defaultValue: 10,
      tooltip: 'Maximum number of concurrent connections',
      attrs: {
        min: 1,
        max: 100,
        step: 1
      }
    })
  }
}

export const SliderSetting: Story = {
  args: {
    setting: createMockSetting({
      name: 'Volume Level',
      type: 'slider',
      defaultValue: 50,
      tooltip: 'Adjust the volume level',
      attrs: {
        min: 0,
        max: 100,
        step: 5
      }
    })
  }
}

export const ComboSetting: Story = {
  args: {
    setting: createMockSetting({
      name: 'Theme',
      type: 'combo',
      defaultValue: 'dark',
      tooltip: 'Select your preferred theme',
      options: [
        { text: 'Light', value: 'light' },
        { text: 'Dark', value: 'dark' },
        { text: 'Auto', value: 'auto' }
      ]
    })
  }
}

export const ColorSetting: Story = {
  args: {
    setting: createMockSetting({
      name: 'Accent Color',
      type: 'color',
      defaultValue: '#007bff',
      tooltip: 'Choose your accent color'
    })
  }
}

export const ExperimentalSetting: Story = {
  args: {
    setting: createMockSetting({
      name: 'Experimental Feature',
      type: 'boolean',
      defaultValue: false,
      experimental: true,
      tooltip: 'This feature is experimental and may change'
    })
  }
}

export const WithLanguageTag: Story = {
  args: {
    setting: createMockSetting({
      id: 'Comfy.Locale' as any,
      name: 'Language',
      type: 'combo',
      defaultValue: 'en',
      tooltip: 'Select your preferred language',
      options: [
        { text: 'English', value: 'en' },
        { text: 'Spanish', value: 'es' },
        { text: 'French', value: 'fr' }
      ]
    })
  }
}

export const InteractiveBoolean: Story = {
  args: {
    setting: createMockSetting({
      name: 'Interactive Boolean',
      type: 'boolean',
      defaultValue: false,
      tooltip: 'Click to toggle this setting'
    })
  }
}
