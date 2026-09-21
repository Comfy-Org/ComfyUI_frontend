import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CompareTable01 from './CompareTable01.vue'

const meta: Meta<typeof CompareTable01> = {
  title: 'Website/Blocks/CompareTable01',
  component: CompareTable01,
  tags: ['autodocs'],
  args: {
    heading: 'Builder vs. Managed Builds',
    subtitle:
      'Builder is self-serve for packaging and testing your own environment. Managed Builds adds team sharing and enterprise governance.',
    columns: ['BUILDER', 'MANAGED BUILDS'],
    rows: [
      {
        id: 'packaging',
        feature: 'Custom nodes packaging',
        cells: ['Included', 'Included']
      },
      {
        id: 'sharing',
        feature: 'Team sharing',
        cells: ['Not included', 'Enterprise only']
      },
      {
        id: 'governance',
        feature: 'Governance',
        cells: ['Not included', 'Enterprise only']
      },
      {
        id: 'python',
        feature: 'Python dependency auto-resolution',
        cells: ['Included', 'Included']
      }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutSubtitle: Story = {
  args: { subtitle: undefined }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
