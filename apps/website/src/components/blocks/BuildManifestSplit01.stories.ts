import type { Meta, StoryObj } from '@storybook/vue3-vite'

import BuildManifestSplit01 from './BuildManifestSplit01.vue'

const meta: Meta<typeof BuildManifestSplit01> = {
  title: 'Website/Blocks/BuildManifestSplit01',
  component: BuildManifestSplit01,
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
    eyebrow: 'ComfyUI Managed Builds',
    headingTag: 'h1',
    heading:
      'One approved ComfyUI environment.\nAcross your team and deployment targets.',
    body: 'Define the ComfyUI release, custom nodes, models, and dependencies your team is approved to run. Ship the same versioned build wherever the work happens.',
    features: [
      'Private custom nodes and models',
      'Use supported provider keys and existing contracts',
      'Assign approved builds through company identity'
    ],
    primaryCta: { label: 'REQUEST DEMO', href: '/contact/' },
    secondaryCta: { label: 'SEE HOW IT WORKS', href: '#how-it-works' },
    manifestLabel: 'Approved build',
    manifestName: 'Production environment',
    manifestVersion: 'Current',
    manifestItems: [
      {
        id: 'dependencies',
        label: 'ComfyUI and dependencies',
        value: 'Pinned'
      },
      { id: 'nodes', label: 'Custom nodes', value: 'Allowlisted' },
      { id: 'models', label: 'Models', value: 'Approved and private' },
      { id: 'providers', label: 'Provider access', value: 'BYOK' }
    ],
    releaseLabels: [
      { id: 'previous', label: 'Previous release' },
      { id: 'current', label: 'Current release', current: true }
    ],
    deploymentTargets: [
      { id: 'workstations', label: 'Workstations' },
      { id: 'servers', label: 'GPU servers' },
      { id: 'infrastructure', label: 'Customer infrastructure' }
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

export const Section: Story = {
  args: {
    headingTag: 'h2'
  }
}
