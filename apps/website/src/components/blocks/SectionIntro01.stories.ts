import type { Meta, StoryObj } from '@storybook/vue3-vite'

import SectionIntro01 from './SectionIntro01.vue'

const meta: Meta<typeof SectionIntro01> = {
  title: 'Website/Blocks/SectionIntro01',
  component: SectionIntro01,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template: '<div class="min-h-screen bg-primary-comfy-ink"><story /></div>'
    })
  ],
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
    eyebrow: 'WAYS TO SCALE WITH COMFY',
    heading: 'The open standard for visual AI, ready for your organization.',
    subtitle:
      'Your team builds the workflows. Comfy runs them, governs them, and licenses them for commercial use.',
    maxWidth: 'xl'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Desktop: Story = {
  globals: {
    viewport: { value: 'desktop', isRotated: false }
  }
}

export const HeadingOnly: Story = {
  args: {
    eyebrow: undefined,
    subtitle: undefined
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile', isRotated: false }
  }
}
