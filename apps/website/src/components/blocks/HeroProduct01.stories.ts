import type { Meta, StoryObj } from '@storybook/vue3-vite'

import DistributionsScene from '../product/enterprise/DistributionsScene.vue'

import HeroProduct01 from './HeroProduct01.vue'

const meta: Meta<typeof HeroProduct01> = {
  title: 'Website/Blocks/HeroProduct01',
  component: HeroProduct01,
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
    title: 'MANAGED BUILDS',
    body: 'Govern the models, custom nodes, and dependencies your team runs. Create a managed distribution of ComfyUI and deploy the same build on local infrastructure or through the Developer Platform.',
    primaryCta: { label: 'REQUEST DEMO', href: '/contact/' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutTag: Story = {
  args: { tag: undefined }
}

export const WithSecondaryCta: Story = {
  args: {
    secondaryCta: { label: 'SEE HOW IT WORKS', href: '#how-it-works' }
  }
}

export const AsSecondaryHeading: Story = {
  args: { headingTag: 'h2' }
}

const managedBuildsRender: Story['render'] = (args) => ({
  components: { DistributionsScene, HeroProduct01 },
  setup() {
    return { args }
  },
  template: `
    <HeroProduct01 v-bind="args">
      <template #media>
        <DistributionsScene />
      </template>
    </HeroProduct01>
  `
})

export const ManagedBuildsDesktop: Story = {
  render: managedBuildsRender,
  globals: {
    viewport: { value: 'desktop', isRotated: false }
  }
}

export const ManagedBuildsTablet: Story = {
  render: managedBuildsRender,
  globals: {
    viewport: { value: 'tablet', isRotated: false }
  }
}

export const ManagedBuildsMobile: Story = {
  render: managedBuildsRender,
  globals: {
    viewport: { value: 'mobile', isRotated: false }
  }
}
