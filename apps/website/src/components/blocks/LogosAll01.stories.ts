import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { clientLogos } from '../../data/clientLogos'
import LogosAll01 from './LogosAll01.vue'

const meta: Meta<typeof LogosAll01> = {
  title: 'Website/Blocks/LogosAll01',
  component: LogosAll01,
  tags: ['autodocs'],
  args: {
    logos: clientLogos
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
