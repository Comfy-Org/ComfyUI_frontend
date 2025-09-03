import type { Meta, StoryObj } from '@storybook/vue3-vite'

import SettingDialogContent from './SettingDialogContent.vue'

const meta: Meta<typeof SettingDialogContent> = {
  title: 'Components/Dialog/SettingDialogContent',
  component: SettingDialogContent,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The complete settings dialog content with sidebar navigation and tabbed panels.'
      }
    }
  },
  argTypes: {
    defaultPanel: {
      control: 'select',
      options: [
        'about',
        'keybinding',
        'extension',
        'server-config',
        'user',
        'credits'
      ],
      description: 'The default panel to show when the dialog opens'
    }
  },
  decorators: [
    () => ({
      template:
        '<div style="width: 100vw; height: 100vh; padding: 20px; background: #f5f5f5;"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {}
}

export const AboutPanel: Story = {
  args: {
    defaultPanel: 'about'
  }
}

export const KeybindingPanel: Story = {
  args: {
    defaultPanel: 'keybinding'
  }
}

export const ExtensionPanel: Story = {
  args: {
    defaultPanel: 'extension'
  }
}

export const ServerConfigPanel: Story = {
  args: {
    defaultPanel: 'server-config'
  }
}

export const UserPanel: Story = {
  args: {
    defaultPanel: 'user'
  }
}

export const CreditsPanel: Story = {
  args: {
    defaultPanel: 'credits'
  }
}

// Responsive variants
export const Mobile: Story = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}

export const Tablet: Story = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: 'tablet'
    }
  }
}

export const Desktop: Story = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: 'desktop'
    }
  }
}
