import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AnnouncementBanner from './AnnouncementBanner.vue'

const meta: Meta<typeof AnnouncementBanner> = {
  title: 'Website/Common/AnnouncementBanner',
  component: AnnouncementBanner,
  tags: ['autodocs', 'stable'],
  parameters: {
    layout: 'fullscreen',
    viewport: {
      options: {
        desktop: {
          name: 'Desktop',
          styles: { width: '1440px', height: '1000px' }
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' }
        },
        mobile: {
          name: 'Mobile',
          styles: { width: '390px', height: '844px' }
        }
      }
    }
  },
  args: {
    data: {
      id: 'announcement',
      title: 'Now turn your agent into a creative technologist.',
      link: {
        href: '/mcp',
        title: 'Start Comfy MCP',
        buttonVariant: 'underlineLink'
      }
    },
    version: 'storybook'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Desktop: Story = {
  globals: {
    viewport: { value: 'desktop', isRotated: false }
  }
}

export const Tablet: Story = {
  globals: {
    viewport: { value: 'tablet', isRotated: false }
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile', isRotated: false }
  }
}
