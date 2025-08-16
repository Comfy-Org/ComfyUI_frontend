import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AboutPanel from './AboutPanel.vue'

const meta: Meta<typeof AboutPanel> = {
  title: 'Components/Setting/AboutPanel',
  component: AboutPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The About panel displays project information, badges, and system statistics.'
      }
    }
  },
  decorators: [
    () => ({
      template:
        '<div style="max-width: 600px; min-height: 400px; padding: 16px;"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          'The default About panel showing project badges and system information.'
      }
    }
  }
}

export const WithSystemStats: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'About panel with system statistics visible.'
      }
    }
  }
}

export const Mobile: Story = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    },
    docs: {
      description: {
        story: 'About panel optimized for mobile devices.'
      }
    }
  }
}
