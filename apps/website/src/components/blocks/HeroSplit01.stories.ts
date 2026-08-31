import type { Meta, StoryObj } from '@storybook/vue3-vite'

import HeroSplit01 from './HeroSplit01.vue'

const meta: Meta<typeof HeroSplit01> = {
  title: 'Website/Blocks/HeroSplit01',
  component: HeroSplit01,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink"><story /></div>'
    })
  ],
  args: {
    badgeText: 'DESKTOP',
    titleHighlight: 'Professional control.',
    title: ' Run ComfyUI on your own machine.',
    subtitle:
      'Build, iterate, and run visual AI workflows with complete local control.',
    features: [
      'Open source and extensible',
      'Runs locally on your hardware',
      'Visible nodes, parameters, and outputs'
    ],
    primaryCta: {
      label: 'DOWNLOAD',
      href: '/download'
    },
    secondaryCta: {
      label: 'VIEW ON GITHUB',
      href: 'https://github.com/comfyanonymous/ComfyUI',
      target: '_blank'
    },
    imageSrc: '/images/mcp/mcp-thumb-keyart.webp',
    imageAlt: 'Abstract Comfy artwork'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ImageLeft: Story = {
  args: {
    imagePosition: 'left'
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
