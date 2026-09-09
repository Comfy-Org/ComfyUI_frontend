import type { Meta, StoryObj } from '@storybook/vue3-vite'

import EnterpriseHeroScene from '../product/enterprise/EnterpriseHeroScene.vue'

import { externalLinks } from '../../config/routes'
import HeroSplit01 from './HeroSplit01.vue'

const meta: Meta<typeof HeroSplit01> = {
  title: 'Website/Blocks/HeroSplit01',
  component: HeroSplit01,
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
          styles: { width: '1440px', height: '1000px' },
          type: 'desktop'
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
          type: 'tablet'
        },
        mobile: {
          name: 'Mobile',
          styles: { width: '390px', height: '844px' },
          type: 'mobile'
        }
      }
    }
  },
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

const enterpriseArgs = {
  badgeText: 'ENTERPRISE',
  title: 'Govern ComfyUI across\nevery team and runtime.',
  subtitle:
    'Standardize how teams build, run, and deploy visual AI with ComfyUI Managed Builds, production capacity, commercial licensing, and hands-on implementation support.',
  features: [
    'Approved, reproducible ComfyUI Managed Builds',
    'Dedicated GPU capacity, priority queueing, and enterprise SLAs',
    'Commercial licensing, security review, and hands-on delivery'
  ],
  primaryCta: { label: 'REQUEST DEMO', href: '/contact/' },
  secondaryCta: {
    label: 'VIEW TRUST CENTER',
    href: externalLinks.trustCenter,
    target: '_blank' as const
  },
  imageSrc: undefined
}

const enterpriseRender: Story['render'] = (args) => ({
  components: { EnterpriseHeroScene, HeroSplit01 },
  setup() {
    return { args }
  },
  template: `
    <HeroSplit01 v-bind="args">
      <template #media>
        <EnterpriseHeroScene />
      </template>
    </HeroSplit01>
  `
})

export const EnterpriseDesktop: Story = {
  args: enterpriseArgs,
  render: enterpriseRender,
  globals: {
    viewport: { value: 'desktop', isRotated: false }
  }
}

export const EnterpriseTablet: Story = {
  args: enterpriseArgs,
  render: enterpriseRender,
  globals: {
    viewport: { value: 'tablet', isRotated: false }
  }
}

export const EnterpriseMobile: Story = {
  args: enterpriseArgs,
  render: enterpriseRender,
  globals: {
    viewport: { value: 'mobile', isRotated: false }
  }
}
