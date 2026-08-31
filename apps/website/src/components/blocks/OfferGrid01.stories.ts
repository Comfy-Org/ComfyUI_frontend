import type { Meta, StoryObj } from '@storybook/vue3-vite'

import OfferGrid01 from './OfferGrid01.vue'

const meta: Meta<typeof OfferGrid01> = {
  title: 'Website/Blocks/OfferGrid01',
  component: OfferGrid01,
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
    eyebrow: 'ONE ENTERPRISE RELATIONSHIP',
    heading: 'The open standard for visual AI, ready for your organization.',
    description:
      'Start with the problem you need to solve. Comfy brings the product, commercial terms, and implementation support together.',
    featuredOffer: {
      id: 'managed-builds',
      label: 'LEAD OFFER',
      title: 'ComfyUI Managed Builds',
      description:
        'Create approved, reproducible ComfyUI environments and assign them across workstations, studio GPU servers, and customer infrastructure.',
      cta: {
        label: 'VIEW MANAGED BUILDS',
        href: '/enterprise/managed-builds/'
      }
    },
    offers: [
      {
        id: 'team-plans',
        label: 'FOR TEAMS',
        title: 'Team plans',
        description:
          'Give teams a shared credit pool, centralized billing, and Single Sign-On for Cloud GPU time and partner-model usage.',
        cta: { label: 'REQUEST DEMO', href: '/contact/' }
      },
      {
        id: 'commercial-licensing',
        label: 'COMMERCIAL RIGHTS',
        title: 'Model licensing',
        description:
          'Commercial terms for MiniMax today, with local model terms available by provider on request.',
        cta: {
          label: 'VIEW MINIMAX LICENSING',
          href: '/minimax/license/'
        }
      },
      {
        id: 'forward-deployed-creatives',
        label: 'HANDS-ON DELIVERY',
        title: 'Forward Deployed Creatives',
        description:
          'Work with builders who design production-ready Comfy Workflows alongside your creative and technical teams.',
        cta: {
          label: 'VIEW THE OFFERING',
          href: '/forward-deployed-creatives/'
        }
      }
    ]
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
