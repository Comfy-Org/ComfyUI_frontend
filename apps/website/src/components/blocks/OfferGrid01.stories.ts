import type { Meta, StoryObj } from '@storybook/vue3-vite'

import OfferGrid01 from './OfferGrid01.vue'

const meta: Meta<typeof OfferGrid01> = {
  title: 'Website/Blocks/OfferGrid01',
  component: OfferGrid01,
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
    eyebrow: 'ONE ENTERPRISE RELATIONSHIP',
    heading: 'The open standard for visual AI, ready for your organization.',
    description:
      'Start with the problem you need to solve. Comfy brings the product, commercial terms, and implementation support together.',
    featuredOffer: {
      id: 'managed-builds',
      label: 'MANAGED DISTRIBUTION',
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
        label: 'SELF-SERVE FOR TEAMS',
        title: 'Team plans',
        description:
          'Invite members, run workflows concurrently, share one credit pool with centralized billing, and manage role-based permissions in a self-serve Comfy Cloud plan.',
        cta: { label: 'SUBSCRIBE NOW', href: '/pricing' }
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

const withoutFeaturedLabelArgs = {
  eyebrow: 'FOR PRODUCTION TEAMS',
  heading: 'Standardize how your team runs visual AI.',
  description:
    'Move from individual setups to versioned environments, shared access, and clear operating controls.',
  featuredOffer: {
    id: 'managed-environments',
    title: 'Managed production environments',
    description:
      'Pin workflow dependencies once, then distribute approved environments across every workstation and runtime your team uses.',
    cta: {
      label: 'VIEW MANAGED BUILDS',
      href: '/enterprise/managed-builds/'
    }
  },
  offers: [
    {
      id: 'team-access',
      label: 'TEAM ACCESS',
      title: 'Shared plans',
      description:
        'Keep billing, usage, and access in one place as your team grows.',
      cta: { label: 'VIEW PLANS', href: '/pricing' }
    },
    {
      id: 'model-governance',
      label: 'MODEL GOVERNANCE',
      title: 'Approved model access',
      description:
        'Set the models and credentials each team can use across its workflows.',
      cta: { label: 'VIEW GOVERNANCE', href: '/enterprise/' }
    },
    {
      id: 'implementation-support',
      label: 'IMPLEMENTATION SUPPORT',
      title: 'Builders for your workflow',
      description:
        'Work with specialists who build alongside your creative and technical teams.',
      cta: {
        label: 'VIEW SERVICES',
        href: '/forward-deployed-creatives/'
      }
    }
  ]
}

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

export const WithoutFeaturedLabelDesktop: Story = {
  args: withoutFeaturedLabelArgs,
  globals: {
    viewport: { value: 'desktop', isRotated: false }
  }
}

export const WithoutFeaturedLabelTablet: Story = {
  args: withoutFeaturedLabelArgs,
  globals: {
    viewport: { value: 'tablet', isRotated: false }
  }
}

export const WithoutFeaturedLabelMobile: Story = {
  args: withoutFeaturedLabelArgs,
  globals: {
    viewport: { value: 'mobile', isRotated: false }
  }
}
